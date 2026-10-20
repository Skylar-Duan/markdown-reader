import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupTabReorder } from "../src/modules/tabReorder.js";

const cleanups = [];

function setup(container, options) {
  const cleanup = setupTabReorder(container, options);
  cleanups.push(cleanup);
  return cleanup;
}

function makeTabs(ids = [1, 2, 3]) {
  const container = document.createElement("ul");
  document.body.appendChild(container);
  container.getBoundingClientRect = () => ({ left: 0, right: 400, top: 0, bottom: 40, width: 400, height: 40 });
  for (const id of ids) {
    const tab = document.createElement("li");
    tab.className = "tab";
    tab.dataset.tabId = String(id);
    tab.getBoundingClientRect = () => {
      const index = [...container.children].indexOf(tab);
      return { left: index * 100, right: (index + 1) * 100, width: 100, top: 0, bottom: 40, height: 40 };
    };
    tab.appendChild(document.createElement("span"));
    container.appendChild(tab);
  }
  return container;
}

function pointer(container, type, target, { x, y = 10, button = 0, pointerId = 1 } = {}) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button });
  Object.defineProperty(event, "pointerId", { value: pointerId });
  target.dispatchEvent(event);
}

function ids(container) {
  return [...container.children].map((tab) => Number(tab.dataset.tabId));
}

describe("setupTabReorder", () => {
  beforeEach(() => { document.body.innerHTML = ""; });
  afterEach(() => { cleanups.splice(0).forEach((cleanup) => cleanup()); });

  it("moves tabs in the DOM and reports numeric IDs on release", () => {
    const container = makeTabs();
    const onReorder = vi.fn();
    setup(container, { onReorder });

    pointer(container, "pointerdown", container.children[0], { x: 20 });
    pointer(container, "pointermove", container, { x: 280 });
    expect(ids(container)).toEqual([2, 3, 1]);
    expect(container.lastElementChild.classList.contains("tab-dragging")).toBe(true);
    pointer(container, "pointerup", container, { x: 280 });

    expect(onReorder).toHaveBeenCalledOnce();
    expect(onReorder).toHaveBeenCalledWith([2, 3, 1]);
    expect(container.querySelector(".tab-dragging")).toBeNull();
  });

  it("restores the original DOM order on Escape and pointercancel", () => {
    for (const cancelBy of ["escape", "pointercancel"]) {
      const container = makeTabs();
      const onReorder = vi.fn();
      setup(container, { onReorder });
      pointer(container, "pointerdown", container.children[0], { x: 20 });
      pointer(container, "pointermove", container, { x: 280 });
      if (cancelBy === "escape") window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      else pointer(container, "pointercancel", container, { x: 280 });

      expect(ids(container)).toEqual([1, 2, 3]);
      expect(onReorder).not.toHaveBeenCalled();
    }
  });

  it("does not start from the close button or for non-left input", () => {
    const container = makeTabs();
    const onReorder = vi.fn();
    setup(container, { onReorder });
    const close = document.createElement("button");
    close.className = "tab-close";
    container.children[0].appendChild(close);

    pointer(container, "pointerdown", close, { x: 20 });
    pointer(container, "pointermove", container, { x: 280 });
    pointer(container, "pointerup", container, { x: 280 });
    expect(ids(container)).toEqual([1, 2, 3]);

    pointer(container, "pointerdown", container.children[0], { x: 20, button: 2 });
    pointer(container, "pointermove", container, { x: 280 });
    pointer(container, "pointerup", container, { x: 280 });
    expect(ids(container)).toEqual([1, 2, 3]);
    expect(onReorder).not.toHaveBeenCalled();
  });

  it("waits until movement exceeds five pixels and suppresses the follow-up click", () => {
    const container = makeTabs();
    const onReorder = vi.fn();
    const onTabClick = vi.fn();
    container.addEventListener("click", onTabClick);
    setup(container, { onReorder });

    pointer(container, "pointerdown", container.children[0], { x: 20 });
    pointer(container, "pointermove", container, { x: 25 });
    expect(ids(container)).toEqual([1, 2, 3]);
    expect(container.querySelector(".tab-dragging")).toBeNull();
    pointer(container, "pointermove", container, { x: 26 });
    expect(container.querySelector(".tab-dragging")).not.toBeNull();
    pointer(container, "pointerup", container, { x: 26 });
    container.children[0].dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

    expect(onReorder).toHaveBeenCalledOnce();
    expect(onTabClick).not.toHaveBeenCalled();
  });

  it("preserves ordinary tab clicks and captures only after drag starts", () => {
    const container = makeTabs();
    const setCapture = vi.fn();
    container.setPointerCapture = setCapture;
    const onTabClick = vi.fn();
    container.addEventListener("click", onTabClick);
    setup(container);

    pointer(container, "pointerdown", container.children[0], { x: 20 });
    expect(setCapture).not.toHaveBeenCalled();
    pointer(container, "pointerup", container.children[0], { x: 20 });
    container.children[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onTabClick).toHaveBeenCalledOnce();

    pointer(container, "pointerdown", container.children[0], { x: 20, pointerId: 9 });
    pointer(container, "pointermove", window, { x: 280, pointerId: 9 });
    expect(setCapture).toHaveBeenCalledWith(9);
  });

  it("filters unrelated pointers and listens for release outside the tab container", () => {
    const container = makeTabs();
    const onReorder = vi.fn();
    setup(container, { onReorder });
    pointer(container, "pointerdown", container.children[0], { x: 20, pointerId: 1 });
    pointer(container, "pointermove", window, { x: 280, pointerId: 2 });
    pointer(container, "pointerup", window, { x: 280, pointerId: 2 });
    expect(ids(container)).toEqual([1, 2, 3]);
    expect(onReorder).not.toHaveBeenCalled();

    pointer(container, "pointermove", window, { x: 280, pointerId: 1 });
    pointer(container, "pointerup", window, { x: 280, pointerId: 1 });
    expect(ids(container)).toEqual([2, 3, 1]);
    expect(onReorder).toHaveBeenCalledWith([2, 3, 1]);
  });

  it("cancels on lost capture, window blur, or a tab subtree rebuild", async () => {
    for (const cancelBy of ["lostpointercapture", "blur", "refresh"]) {
      const container = makeTabs();
      const originalTab = container.children[0];
      const onReorder = vi.fn();
      setup(container, { onReorder });
      pointer(container, "pointerdown", originalTab, { x: 20 });
      pointer(container, "pointermove", window, { x: 280 });
      if (cancelBy === "lostpointercapture") {
        pointer(container, "lostpointercapture", container, { x: 280 });
      } else if (cancelBy === "blur") {
        window.dispatchEvent(new Event("blur"));
      } else {
        container.innerHTML = "";
        for (const id of [1, 2, 3]) {
          const replacement = document.createElement("li");
          replacement.className = "tab";
          replacement.dataset.tabId = String(id);
          container.appendChild(replacement);
        }
        await Promise.resolve();
      }

      expect(onReorder).not.toHaveBeenCalled();
      if (cancelBy === "refresh") {
        expect(originalTab.parentElement).toBeNull();
        expect([...container.children].some((tab) => tab === originalTab)).toBe(false);
      } else {
        expect(originalTab.parentElement).toBe(container);
        expect(ids(container)).toEqual([1, 2, 3]);
      }
    }
  });

  it("keeps delegated handling after the tab elements are rebuilt", () => {
    const container = makeTabs();
    const onReorder = vi.fn();
    setup(container, { onReorder });
    container.innerHTML = "";
    for (const id of [4, 5, 6]) {
      const tab = document.createElement("li");
      tab.className = "tab";
      tab.dataset.tabId = String(id);
      tab.getBoundingClientRect = () => {
        const index = [...container.children].indexOf(tab);
        return { left: index * 100, right: (index + 1) * 100, width: 100 };
      };
      container.appendChild(tab);
    }
    pointer(container, "pointerdown", container.children[0], { x: 20 });
    pointer(container, "pointermove", container, { x: 280 });
    pointer(container, "pointerup", container, { x: 280 });
    expect(onReorder).toHaveBeenCalledWith([5, 6, 4]);
  });
});
