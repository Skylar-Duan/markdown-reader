let nextDialogId = 0;

export function askRestoreSession(i18n, session) {
  const previousFocus = document.activeElement;
  const dialog = document.createElement("dialog");
  dialog.className = "restore-dialog";
  const id = `restore-session-${++nextDialogId}`;
  dialog.setAttribute("aria-labelledby", `${id}-title`);
  dialog.setAttribute("aria-describedby", `${id}-description`);
  const add = (tag, className, text, parent = dialog) => {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = text;
    parent.appendChild(element);
    return element;
  };
  add("div", "restore-icon", "↺").setAttribute("aria-hidden", "true");
  add("p", "restore-eyebrow", i18n.t("session.eyebrow"));
  add("h2", "restore-title", i18n.t("session.title")).id = `${id}-title`;
  add("p", "restore-description", i18n.t("session.description", { count: session.tabs.length })).id = `${id}-description`;
  const files = add("ul", "restore-files");
  session.tabs.forEach(({ filePath }) => {
    const file = add("li", "restore-file", undefined, files);
    const boundary = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
    add("span", "restore-file-name", filePath.slice(boundary + 1), file);
    add("span", "restore-file-path", boundary < 0 ? "" : filePath.slice(0, boundary + 1), file);
    file.title = filePath;
  });
  add("p", "restore-summary", i18n.t("session.summary", { count: session.tabs.length }));
  const actions = add("div", "restore-actions");
  const fresh = add("button", "restore-fresh", i18n.t("session.fresh"), actions);
  const restore = add("button", "restore-primary", i18n.t("session.restore"), actions);
  fresh.type = restore.type = "button";
  restore.autofocus = true;

  return new Promise(resolve => {
    let settled = false;
    const finish = choice => {
      if (settled) return;
      settled = true;
      fresh.removeEventListener("click", onFresh);
      restore.removeEventListener("click", onRestore);
      dialog.removeEventListener("cancel", onCancel);
      dialog.removeEventListener("close", onClose);
      if (dialog.open) dialog.close();
      dialog.remove();
      if (previousFocus?.isConnected) previousFocus.focus();
      resolve(choice);
    };
    const onFresh = () => finish(false);
    const onRestore = () => finish(true);
    const onCancel = event => { event.preventDefault(); finish(false); };
    const onClose = () => finish(false);
    fresh.addEventListener("click", onFresh);
    restore.addEventListener("click", onRestore);
    dialog.addEventListener("cancel", onCancel);
    dialog.addEventListener("close", onClose);
    document.body.appendChild(dialog);
    dialog.showModal();
    restore.focus();
  });
}
