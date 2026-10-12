// sidebarResize.js — drag the outline's right edge to change its width

const KEY = "md-reader.sidebarWidth";
const MIN = 80;
const MAX = 600;
const DEFAULT = 240;

function clamp(w) {
  // Never let the outline eat more than half the window
  const max = Math.min(MAX, Math.floor(window.innerWidth / 2));
  return Math.max(MIN, Math.min(max, Math.round(w)));
}

function apply(w) {
  document.documentElement.style.setProperty("--sidebar-width", `${w}px`);
}

export function setupSidebarResize(handle, sidebar) {
  const stored = parseFloat(localStorage.getItem(KEY));
  let width = stored ? clamp(stored) : DEFAULT;
  apply(width);

  handle.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    const left = sidebar.getBoundingClientRect().left;
    document.body.classList.add("resizing-sidebar");

    const onMove = (ev) => {
      width = clamp(ev.clientX - left);
      apply(width);
    };
    const onUp = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      document.body.classList.remove("resizing-sidebar");
      localStorage.setItem(KEY, width);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  });

  // Double-click restores the default width
  handle.addEventListener("dblclick", () => {
    width = DEFAULT;
    apply(width);
    localStorage.setItem(KEY, width);
  });

  // Window shrank: keep the outline within half the window
  window.addEventListener("resize", () => {
    const w = clamp(width);
    if (w !== width) { width = w; apply(width); }
  });
}
