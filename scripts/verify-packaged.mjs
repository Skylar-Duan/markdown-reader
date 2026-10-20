// Run against the installed app launched with a separate WEBVIEW2_USER_DATA_FOLDER
// and WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333.
// Uses 02's existing Playwright tooling; never run against the user's real profile.
// node scripts/verify-packaged.mjs [CDP URL]
import { createRequire } from "node:module";
import { mkdir, writeFile, readFile, rename } from "node:fs/promises";
import { resolve, join } from "node:path";
const requireTool = createRequire(new URL("../../html-editor/package.json", import.meta.url));
const { chromium } = requireTool("@playwright/test");
const fixtureDir = resolve(".tmp/packaged-check");
const shotDir = resolve("界面截图/2026-10-20");
async function atomicWrite(file, content) {
  const temporary = `${file}.tmp`;
  await writeFile(temporary, content, "utf8");
  if (await readFile(temporary, "utf8") !== content) throw new Error("Fixture write verification failed");
  await rename(temporary, file);
}
await mkdir(fixtureDir, { recursive: true });
await mkdir(shotDir, { recursive: true });
const files = ["阅读笔记.md", "需求清单.md", "界面设计.md"].map(name => join(fixtureDir, name));
const longText = "# 阅读笔记\n\n" + Array.from({ length: 60 }, (_, i) => `## 第 ${i + 1} 节\n\n这是一段用于验证阅读位置的示例正文。\n\n`).join("");
await Promise.all(files.map((file, i) => atomicWrite(file, i === 0 ? longText : `# ${["阅读笔记", "需求清单", "界面设计"][i]}\n\n这是一份用于验收的演示文档。\n`)));
const browser = await chromium.connectOverCDP(process.argv[2] || "http://127.0.0.1:9333");
const page = browser.contexts().flatMap(c => c.pages()).find(p => /tauri\.localhost|localhost/.test(p.url()));
if (!page) throw new Error("No packaged app webview");
const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail === undefined ? "" : `: ${JSON.stringify(detail)}`}`);
}
const settle = () => page.waitForTimeout(350);
const ready = async () => {
  await page.waitForFunction(() => !!window.__app?.tabs.length && !!window.__app?.editor);
  await settle();
};
const snapshot = () => page.evaluate(() => ({
  ids: __app.tabs.map(t => t.id),
  names: __app.tabs.map(t => t.filePath?.split(/[\\/]/).pop() || "untitled"),
  active: __app.state?.id,
  activeName: __app.state?.filePath?.split(/[\\/]/).pop(),
  scroll: document.querySelector("#content").scrollTop,
  session: JSON.parse(localStorage.getItem("md-reader.session") || "null")
}));
const reload = async () => { await page.reload(); await ready(); };
const beforeUnloadSeed = value => page.evaluate(data => {
  window.addEventListener("beforeunload", () => localStorage.setItem("md-reader.session", data), { once: true });
}, value);
try {
  await ready();
  if (await page.locator("dialog[open]").count()) throw new Error("Verification profile is not empty; use a fresh dedicated profile");
  await page.evaluate(paths => Promise.all([]).then(async () => {
    localStorage.setItem("md-reader.locale", "zh-CN");
    __app.i18n.setLocale("zh-CN");
    __app.theme.set("light");
    for (const path of paths) await __app.fileOps.open(path);
  }), files);
  await settle();
  let s = await snapshot();
  check("真实Rust命令打开三份文档", s.names.join("|") === "阅读笔记.md|需求清单.md|界面设计.md", s.names);
  const originalActive = s.active;
  const first = await page.locator(".tab").nth(0).boundingBox();
  const last = await page.locator(".tab").nth(2).boundingBox();
  await page.mouse.move(first.x + 35, first.y + 15);
  await page.mouse.down();
  await page.mouse.move(last.x + last.width - 12, last.y + 15, { steps: 18 });
  await page.mouse.up();
  s = await snapshot();
  check("鼠标拖动真实标签改变顺序", s.names.join("|") === "需求清单.md|界面设计.md|阅读笔记.md", s.names);
  check("拖动后台标签保持当前文档", s.active === originalActive);
  await page.locator(".tab-name").filter({ hasText: "阅读笔记.md" }).click();
  await settle();
  s = await snapshot();
  check("拖动后普通单击可切换标签", s.activeName === "阅读笔记.md");
  await page.evaluate(() => { document.querySelector("#content").scrollTop = 650; });
  await settle();
  await page.locator(".tab-name").filter({ hasText: "需求清单.md" }).click();
  await settle();
  await page.locator(".tab-name").filter({ hasText: "阅读笔记.md" }).click();
  await settle();
  s = await snapshot();
  check("切换后保留阅读位置", Math.abs(s.scroll - 650) < 3, s.scroll);
  await page.screenshot({ path: join(shotDir, "标签拖动排序.png") });
  // Native Escape must cancel a drag without switching or changing the model.
  const beforeCancel = (await snapshot()).names.join("|");
  const start = await page.locator(".tab").nth(0).boundingBox();
  const end = await page.locator(".tab").nth(2).boundingBox();
  await page.mouse.move(start.x + 30, start.y + 15);
  await page.mouse.down();
  await page.mouse.move(end.x + end.width - 10, end.y + 15, { steps: 12 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  check("Esc取消拖动并恢复顺序", (await snapshot()).names.join("|") === beforeCancel);
  await reload();
  await page.locator("dialog[open]").waitFor();
  check("启动询问恢复并列出全部文件", await page.locator(".restore-file").count() === 3);
  await page.screenshot({ path: join(shotDir, "恢复上次文档-浅色.png") });
  const countBefore = await page.locator(".tab").count();
  await page.keyboard.press("Control+t");
  check("弹窗内快捷键不创建后台标签", await page.locator(".tab").count() === countBefore);
  await page.getByRole("button", { name: "恢复文档", exact: true }).click();
  await page.waitForFunction(() => __app.tabs.filter(t => t.filePath).length === 3);
  await settle();
  s = await snapshot();
  check("恢复标签顺序和活动文档", s.names.join("|") === beforeCancel && s.activeName === "阅读笔记.md", s.names);
  check("恢复阅读位置", Math.abs(s.scroll - 650) < 3, s.scroll);
  check("存储中没有正文内容", !JSON.stringify(s.session).includes("示例正文") && !JSON.stringify(s.session).includes("rawText"));
  await page.locator(".tab").filter({ hasText: "需求清单.md" }).locator(".tab-close").click();
  await settle();
  check("关闭后台标签保持当前文档", (await snapshot()).activeName === "阅读笔记.md");
  // Edit a temporary named file, then open another: no discard prompt or lost edit.
  await page.keyboard.press("Control+e");
  await settle();
  await page.evaluate(() => __app.editor.vditor.insertValue("保留未保存的测试文字"));
  await page.evaluate(path => __app.fileOps.open(path), files[1]);
  check("打开新文档保留原标签未保存文字", await page.evaluate(path => __app.tabs.some(t => t.filePath === path && t.rawText.includes("保留未保存的测试文字") && t.dirty), files[0]));
  // Reset only our disposable test document to avoid native unsaved-close prompts.
  await page.evaluate(async path => {
    const t = __app.tabs.find(t => t.filePath === path);
    await __app.activateTab(t.id);
    __app.editor.clearDirty();
    __app.state.dirty = false;
    await __app.fileOps.save();
  }, files[0]);
  check("CtrlS对应真实保存命令仅写演示文件", (await readFile(files[0], "utf8")).includes("保留未保存的测试文字"));
  await page.evaluate(() => __app.theme.set("dark"));
  await reload();
  await page.locator("dialog[open]").waitFor();
  await page.screenshot({ path: join(shotDir, "恢复上次文档-深色.png") });
  await page.getByRole("button", { name: "恢复文档", exact: true }).click();
  await page.waitForFunction(() => __app.tabs.filter(t => t.filePath).length === 3);
  await settle();
  check("恢复阅读编辑模式", await page.evaluate(() => __app.state.mode === "edit"));
  await reload();
  await page.locator("dialog[open]").waitFor();
  await page.getByRole("button", { name: "开始新会话", exact: true }).click();
  check("开始新会话清空恢复记录", (await snapshot()).session === null);
  await reload();
  check("空白会话下次启动不弹窗", await page.locator("dialog[open]").count() === 0);
  const good = { filePath: files[1], mode: "read", contentScrollTop: 0 };
  const missing = { filePath: join(fixtureDir, "已移动.md"), mode: "read" };
  await beforeUnloadSeed(JSON.stringify({ version: 1, tabs: [missing, good], activeIndex: 0 }));
  await reload();
  await page.getByRole("button", { name: "恢复文档", exact: true }).click();
  await page.waitForFunction(() => __app.tabs.some(t => t.filePath));
  await settle();
  s = await snapshot();
  check("缺失文件不阻止其他文档恢复", s.names.join("|") === "需求清单.md");
  check("缺失文件有中文说明", (await page.locator(".toast").innerText()).includes("1 份文档无法恢复"));
  // Smallest supported window: list scrolls, both decisions stay reachable.
  await beforeUnloadSeed(JSON.stringify({ version: 1, tabs: Array.from({ length: 18 }, (_, i) => ({ filePath: join(fixtureDir, `长名称文档-${i + 1}.md`) })), activeIndex: 0 }));
  await reload();
  await page.locator("dialog[open]").waitFor();
  await page.setViewportSize({ width: 600, height: 400 });
  await page.screenshot({ path: join(shotDir, "恢复弹窗-小窗口.png") });
  check("长列表在小窗口仍可操作", await page.getByRole("button", { name: "恢复文档", exact: true }).isVisible() && await page.locator(".restore-file").count() === 18);
  await page.keyboard.press("Escape");
  check("Esc开始新会话", await page.locator("dialog[open]").count() === 0 && (await snapshot()).session === null);
  await page.setViewportSize({ width: 1100, height: 760 });
  await beforeUnloadSeed("{broken session");
  await reload();
  check("损坏恢复记录不影响启动", await page.locator("dialog[open]").count() === 0);
  await page.keyboard.press("Control+e");
  await settle();
  await page.evaluate(() => __app.editor.vditor.insertValue("新建草稿也要保留"));
  await page.evaluate(path => __app.fileOps.open(path), files[1]);
  check("欢迎页刚输入的草稿不会被新文件覆盖", await page.evaluate(() => __app.tabs.some(t => !t.filePath && t.rawText.includes("新建草稿也要保留") && t.dirty)));
  await page.evaluate(() => { for (const t of [...__app.tabs]) if (!t.filePath) __app.removeTab(t.id); });
  const manyFiles = Array.from({ length: 12 }, (_, i) => join(fixtureDir, `测试文档-${String(i + 1).padStart(2, "0")}.md`));
  await Promise.all(manyFiles.map((file, i) => atomicWrite(file, `# 文档 ${i + 1}\n`)));
  await page.evaluate(async paths => { for (const p of paths) await __app.fileOps.open(p); }, manyFiles);
  const overflowing = await page.locator(".tab").first().boundingBox();
  const strip = await page.locator("#tab-list").boundingBox();
  const firstId = (await snapshot()).ids[0];
  await page.mouse.move(overflowing.x + 25, overflowing.y + 15);
  await page.mouse.down();
  await page.mouse.move(strip.x + strip.width - 3, overflowing.y + 15, { steps: 20 });
  await page.waitForTimeout(750);
  await page.mouse.up();
  s = await snapshot();
  check("多标签拖到边缘自动横向滚动并排序", await page.locator("#tab-list").evaluate(el => el.scrollLeft > 0) && s.ids.indexOf(firstId) > 5);
  await page.screenshot({ path: join(shotDir, "多标签横向拖动.png") });
  await reload();
  await page.getByRole("button", { name: "开始新会话", exact: true }).click();
  await atomicWrite(join(shotDir, "verification.json"), JSON.stringify({ checks, passed: checks.filter(c => c.ok).length, total: checks.length }, null, 2));
  if (checks.some(c => !c.ok)) process.exitCode = 1;
} finally {
  await browser.close();
}
