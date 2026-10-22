// Native regression check. Build with scripts/workspace-test.tauri.json (separate app ID),
// then run from this directory. All windows are hidden, files and profile isolated.
import { createRequire } from "node:module";
import { spawn, execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { resolve, join } from "node:path";
const requireTool = createRequire(new URL("../../html-editor/package.json", import.meta.url));
const { chromium } = requireTool("@playwright/test");
const exe = resolve(process.argv[2] || "src-tauri/target/release/markdown-reader.exe");
const executable = await readFile(exe);
const isolatedBuild = executable.includes(Buffer.from("com.dbwen.mdreader.workspace-check"))
  || executable.includes(Buffer.from("com.dbwen.mdreader.verify261022"));
if (!isolatedBuild && process.env.MD_READER_VERIFY_INSTALLED !== "1") {
  throw new Error("Build with scripts/workspace-test.tauri.json first. Installed-app checks require MD_READER_VERIFY_INSTALLED=1 and all real reader windows closed.");
}
const root = resolve(".tmp/workspace-check-261022");
const evidence = resolve("界面截图/2026-10-22");
await mkdir(root, { recursive: true });
await mkdir(evidence, { recursive: true });
const env = { ...process.env, MD_READER_BACKGROUND_TEST: "1", WEBVIEW2_USER_DATA_FOLDER: join(root, `profile-${Date.now()}`), WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: "--remote-debugging-port=9337 --disable-backgrounding-occluded-windows --disable-renderer-backgrounding" };
const files = Array.from({ length: 7 }, (_, i) => join(root, `文档-${i + 1}.md`));
for (const [i, file] of files.entries()) {
  const text = `# 文档 ${i + 1}\n\n` + "用于多窗口与连续打开检查的演示正文。\n\n".repeat(60);
  await writeFile(file + ".tmp", text, "utf8");
  await rename(file + ".tmp", file);
}
const results = [];
const check = (name, pass, detail) => { results.push({ name, pass: !!pass, detail }); console.log(`${pass ? "PASS" : "FAIL"} ${name}${detail === undefined ? "" : ` ${JSON.stringify(detail)}`}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const launch = args => spawn(exe, args, { env, windowsHide: true, stdio: "ignore" });
let primary;
let browser;
async function connect() {
  for (let i = 0; i < 80; i++) {
    try { return await chromium.connectOverCDP("http://127.0.0.1:9337"); } catch { await sleep(150); }
  }
  throw new Error("Native app did not expose verification webview");
}
async function mainPage() {
  for (let i = 0; i < 100; i++) {
    for (const page of browser.contexts().flatMap(c => c.pages())) {
      if (await page.evaluate(() => window.__app?.workspace?.label === "main").catch(() => false)) return page;
    }
    await sleep(100);
  }
  throw new Error("Main window did not initialize");
}
const ready = page => page.waitForFunction(() => window.__app?.ready, null, { timeout: 20000 });
const names = page => page.evaluate(() => __app.tabs.map(t => t.filePath?.split(/[\\/]/).pop() || "untitled"));
const childExit = child => child.exitCode !== null ? Promise.resolve(child.exitCode) : new Promise((res, rej) => {
  const timer = setTimeout(() => rej(new Error(`Process ${child.pid} did not exit normally`)), 12000);
  child.once("exit", code => { clearTimeout(timer); res(code); });
});
async function closePage(page) {
  await page.evaluate(async () => {
    for (const tab of __app.tabs) tab.dirty = false;
    __app.editor.clearDirty();
    if (__app.state) __app.state.mode = "read";
    await __app.requestWindowClose();
  }).catch(error => { if (!/closed|destroyed/i.test(String(error))) throw error; });
}
try {
  primary = launch([files[0]]);
  browser = await connect();
  // Race additional launches against native and editor startup, before any page is ready.
  const early = [launch([files[1]]), launch([files[2]]), launch([files[3]])];
  let main = await mainPage();
  await main.setViewportSize({ width: 1100, height: 760 });
  await ready(main);
  await main.waitForFunction(() => __app.tabs.filter(t => t.filePath).length === 4);
  check("冷启动阶段连续四次打开不丢文件", (await names(main)).filter(n => n !== "untitled").sort().join("|") === files.slice(0, 4).map(f => f.split(/[\\/]/).pop()).sort().join("|"));
  check("启动只有一个文档窗口", browser.contexts().flatMap(c => c.pages()).length === 1);
  check("额外启动进程转发后全部退出", (await Promise.all(early.map(childExit))).every(code => code === 0));
  check("首次空白配置不显示恢复弹窗", await main.locator("dialog[open]").count() === 0);
  const later = launch([files[4], files[5]]);
  await childExit(later);
  await main.waitForFunction(() => __app.tabs.filter(t => t.filePath).length === 6);
  check("已有窗口一次接收多个文件参数", (await names(main)).length === 6);
  check("已有窗口不再询问恢复", await main.locator("dialog[open]").count() === 0);
  await main.keyboard.press("Control+Shift+n");
  let second;
  for (let i = 0; i < 100; i++) {
    second = browser.contexts().flatMap(c => c.pages()).find(p => p !== main);
    if (second) break;
    await sleep(100);
  }
  if (!second) throw new Error("New window shortcut did not create a second webview");
  await ready(second);
  await second.setViewportSize({ width: 1100, height: 760 });
  check("主动新建窗口不弹恢复", await second.locator("dialog[open]").count() === 0);
  const target = await second.evaluate(() => __app.workspace.label);
  const source = await main.evaluate(() => __app.tabs[0].id);
  await main.evaluate(async id => {
    await __app.activateTab(id);
    document.querySelector("#mode-toggle").click();
  }, source);
  await sleep(150);
  await main.evaluate(() => __app.editor.vditor.insertValue("跨窗保留的未保存文字"));
  const moved = await main.evaluate(({ id, target }) => __app.moveTabToWindow(id, target, 5), { id: source, target });
  check("跨窗口ACK确认后源标签才移除", moved && !await main.evaluate(id => __app.tabs.some(t => t.id === id), source));
  const received = await second.evaluate(() => ({ text: __app.state.rawText, dirty: __app.state.dirty, mode: __app.state.mode, count: __app.tabs.length }));
  check("跨窗保留未保存文字与编辑模式", received.text.includes("跨窗保留的未保存文字") && received.dirty && received.mode === "edit" && received.count === 1);
  check("拆窗仍由原程序进程持有", primary.exitCode === null && (await Promise.all(early.map(childExit))).every(code => code === 0));
  await sleep(300);
  await main.waitForFunction(() => document.querySelectorAll("#tab-list .tab").length >= 3);
  // In-window drag is driven through real pointer input in the hidden packaged webview.
  const before = await main.evaluate(() => __app.tabs.map(t => t.id));
  const first = await main.locator("#tab-list .tab").first().boundingBox();
  const last = await main.locator("#tab-list .tab").nth(2).boundingBox();
  await main.mouse.move(first.x + 25, first.y + 16);
  await main.mouse.down();
  await main.mouse.move(last.x + last.width - 8, last.y + 16, { steps: 15 });
  check("拖动中显示浮动标签与占位", await main.locator(".tab-drag-ghost").count() === 1 && await main.locator(".tab-drag-placeholder").count() === 1);
  await main.screenshot({ path: join(evidence, "标签拖动-浮动与让位.png") });
  await main.mouse.up();
  await sleep(300);
  check("松手落位并清理浮动标签", await main.locator(".tab-drag-ghost").count() === 0 && (await main.evaluate(() => __app.tabs.map(t => t.id)))[0] !== before[0]);
  await main.evaluate(() => __app.workspace.preview(null));
  const previewX = 40;
  await main.evaluate(({ target, x }) => __app.workspace.preview(target, x), { target, x: previewX });
  await second.locator(".tab-drop-marker").waitFor();
  check("另一窗口显示清晰插入位置", await second.locator(".tab-drop-marker").count() === 1);
  await second.screenshot({ path: join(evidence, "跨窗移动-接收与落点.png") });
  await main.evaluate(() => __app.workspace.preview(null));
  await second.evaluate(() => { __app.editor.clearDirty(); __app.state.dirty = false; __app.state.mode = "read"; });
  await closePage(second);
  await sleep(300);
  const next = launch([files[6]]);
  await childExit(next);
  await main.waitForFunction(() => __app.tabs.some(t => t.filePath?.endsWith("文档-7.md")));
  check("关闭副窗后新文件仍加入剩余窗口", await main.locator("dialog[open]").count() === 0);
  const remainingLabel = await main.evaluate(() => __app.workspace.newWindow());
  let remaining;
  for (let i = 0; i < 100; i++) {
    for (const page of browser.contexts().flatMap(c => c.pages())) {
      if (await page.evaluate(label => __app?.workspace?.label === label, remainingLabel).catch(() => false)) remaining = page;
    }
    if (remaining) break;
    await sleep(100);
  }
  if (!remaining) throw new Error("Remaining window did not initialize");
  await ready(remaining);
  await main.evaluate(target => __app.moveTabToWindow(__app.tabs[0].id, target), remainingLabel);
  await closePage(main);
  check("关闭原主窗仍保留副窗与程序", primary.exitCode === null && !remaining.isClosed());
  const afterMain = launch([files[6]]);
  await childExit(afterMain);
  await remaining.waitForFunction(() => __app.tabs.some(t => t.filePath?.endsWith("文档-7.md")));
  check("主窗关闭后新文件直接加入副窗", await remaining.locator("dialog[open]").count() === 0);
  await closePage(remaining);
  check("最后窗口关闭后进程正常退出", await childExit(primary) === 0);
  await browser.close().catch(() => {});
  browser = null;
  primary = launch([]);
  browser = await connect();
  main = await mainPage();
  await main.locator("dialog[open]").waitFor({ timeout: 20000 });
  check("完全关闭后启动才询问恢复", await main.locator(".restore-file").count() > 0);
  const whileRestoring = launch([files[0]]);
  await childExit(whileRestoring);
  check("恢复选择期间再次打开也只有一个弹窗", browser.contexts().flatMap(c => c.pages()).length === 1 && await main.locator("dialog[open]").count() === 1);
  await main.screenshot({ path: join(evidence, "完全关闭后-仅一次恢复.png") });
  await main.locator(".restore-primary").click();
  await ready(main);
  await main.waitForFunction(() => __app.tabs.some(t => t.filePath?.endsWith("文档-1.md")));
  check("恢复选择期间到达的文件随后正常添加", (await names(main)).includes("文档-1.md"));
  await closePage(main);
  await childExit(primary);
} finally {
  if (browser) {
    for (const page of browser.contexts().flatMap(c => c.pages())) await closePage(page).catch(() => {});
    await browser.close().catch(() => {});
  }
  const out = join(evidence, "workspace-verification.json");
  await writeFile(out + ".tmp", JSON.stringify({ results, passed: results.filter(r => r.pass).length, total: results.length }, null, 2));
  await rename(out + ".tmp", out);
}
if (results.some(r => !r.pass)) process.exitCode = 1;
