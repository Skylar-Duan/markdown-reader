const TAB_SELECTOR = ".tab[data-tab-id]";
const DRAG_THRESHOLD = 5;
const VERTICAL_DETACH_MARGIN = 20;
const HORIZONTAL_DETACH_MARGIN = 36;
const EDGE_SIZE = 32;
const SCROLL_STEP = 12;
const ANIMATION_MS = 180;

function getTabs(container) {
  return [...container.children].filter((el) => el.matches?.(TAB_SELECTOR));
}

function tabId(tab) {
  const id = Number(tab.dataset.tabId);
  return Number.isFinite(id) ? id : null;
}

function motionIsReduced() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || false;
}

function layoutRect(container, tab) {
  const containerRect = container.getBoundingClientRect();
  const left = containerRect.left + tab.offsetLeft - container.scrollLeft;
  const top = containerRect.top + tab.offsetTop - container.scrollTop;
  return {
    left,
    top,
    right: left + tab.offsetWidth,
    bottom: top + tab.offsetHeight,
    width: tab.offsetWidth,
    height: tab.offsetHeight
  };
}

function animateLayout(container, mutate, timers) {
  const before = new Map(getTabs(container).map((tab) => [tab, layoutRect(container, tab)]));
  mutate();
  if (motionIsReduced()) return;

  for (const tab of getTabs(container)) {
    const first = before.get(tab);
    if (!first) continue;
    const last = layoutRect(container, tab);
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;

    tab.classList.add("tab-reorder-flip");
    tab.style.transition = "none";
    tab.style.transform = `translate(${dx}px, ${dy}px)`;
    void tab.offsetWidth;
    const raf = window.requestAnimationFrame || ((cb) => setTimeout(cb, 16));
    raf(() => {
      if (!tab.isConnected) return;
      tab.style.transition = "";
      tab.style.transform = "";
      const timer = setTimeout(() => {
        tab.classList.remove("tab-reorder-flip");
        tab.style.transition = "";
        tab.style.transform = "";
        timers.delete(timer);
      }, ANIMATION_MS + 50);
      timers.add(timer);
    });
  }
}

function reorderAt(container, dragged, clientX, timers) {
  const currentTabs = getTabs(container);
  const others = getTabs(container).filter((tab) => tab !== dragged);
  const before = others.find((tab) => {
    const rect = layoutRect(container, tab);
    return clientX < rect.left + rect.width / 2;
  });
  const currentIndex = currentTabs.indexOf(dragged);
  if ((before && currentTabs[currentIndex + 1] === before)
      || (!before && currentIndex === currentTabs.length - 1)) return;
  const mutate = () => {
    if (before) container.insertBefore(dragged, before);
    else if (others.length) container.insertBefore(dragged, others[others.length - 1].nextSibling);
  };
  animateLayout(container, mutate, timers);
}

function restoreOrder(container, ids, timers) {
  const byId = new Map(getTabs(container).map((tab) => [tabId(tab), tab]));
  animateLayout(container, () => {
    for (const id of ids) {
      const tab = byId.get(id);
      if (tab) container.appendChild(tab);
    }
  }, timers);
}

function makeGhost(tab, rect, drag) {
  const ghost = tab.cloneNode(true);
  ghost.classList.remove("tab-active", "tab-dragging", "tab-drag-placeholder", "tab-reorder-flip");
  ghost.classList.add("tab-drag-ghost");
  ghost.removeAttribute("id");
  ghost.setAttribute("aria-hidden", "true");
  ghost.querySelectorAll(".tab-close").forEach((button) => button.remove());
  Object.assign(ghost.style, {
    position: "fixed",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: "0",
    zIndex: "2147483000",
    pointerEvents: "none"
  });
  drag.offsetX = drag.startX - rect.left;
  drag.offsetY = drag.startY - rect.top;
  drag.startRect = rect;
  document.body.appendChild(ghost);
  return ghost;
}

function moveGhost(drag) {
  if (!drag.ghost) return;
  drag.ghost.style.left = `${drag.clientX - drag.offsetX}px`;
  drag.ghost.style.top = `${drag.clientY - drag.offsetY}px`;
}

function settleGhost(ghost, targetRect, accepted, timers) {
  if (!ghost) return;
  if (motionIsReduced()) {
    ghost.remove();
    return;
  }
  ghost.classList.add(accepted ? "tab-drag-ghost-dismiss" : "tab-drag-ghost-settling");
  if (targetRect && !accepted) {
    ghost.style.left = `${targetRect.left}px`;
    ghost.style.top = `${targetRect.top}px`;
    ghost.style.width = `${targetRect.width}px`;
    ghost.style.height = `${targetRect.height}px`;
  }
  const timer = setTimeout(() => {
    ghost.remove();
    timers.delete(timer);
  }, ANIMATION_MS + 80);
  timers.add(timer);
}

/** Add pointer-based in-window reordering and optional cross-window detach hooks. */
export function setupTabReorder(container, { onReorder, onDetach, onDragMove, onDragEnd } = {}) {
  let pending = null;
  let drag = null;
  let suppressClick = false;
  let suppressTimer = null;
  let frame = null;
  const timers = new Set();

  const cancelFrame = () => {
    if (frame === null) return;
    if (typeof window.cancelAnimationFrame === "function") window.cancelAnimationFrame(frame);
    else clearTimeout(frame);
    frame = null;
  };

  const notifyDragMove = (current) => {
    try {
      const result = onDragMove?.({
        tabId: current.id,
        screenX: current.screenX,
        screenY: current.screenY,
        clientX: current.clientX,
        clientY: current.clientY
      });
      result?.catch?.(() => {});
    } catch { /* an optional host hint must not interrupt dragging */ }
  };

  const startDrag = (current) => {
    current.originalOrder = [...current.originalIds];
    current.ghost = makeGhost(current.tab, current.tab.getBoundingClientRect(), current);
    current.tab.classList.add("tab-dragging", "tab-drag-placeholder");
    try {
      if (current.pointerId != null) {
        container.setPointerCapture?.(current.pointerId);
        current.captured = typeof container.hasPointerCapture === "function"
          ? container.hasPointerCapture(current.pointerId)
          : typeof container.setPointerCapture === "function";
      }
    } catch { current.captured = false; }
  };

  const scheduleFrame = () => {
    if (frame !== null || !drag || drag.detaching) return;
    const tick = () => {
      frame = null;
      if (!drag || drag.detaching) return;
      const rect = container.getBoundingClientRect();
      if (drag.clientX < rect.left + EDGE_SIZE) container.scrollLeft -= SCROLL_STEP;
      else if (drag.clientX > rect.right - EDGE_SIZE) container.scrollLeft += SCROLL_STEP;
      else return;
      reorderAt(container, drag.tab, drag.clientX, timers);
      scheduleFrame();
    };
    frame = typeof window.requestAnimationFrame === "function"
      ? window.requestAnimationFrame(tick)
      : setTimeout(tick, 16);
  };

  const completeDrag = async (current, { cancelled = false, detached = false } = {}) => {
    cancelFrame();
    const tabStillInContainer = current.tab.parentElement === container;

    if (cancelled || detached) {
      if (tabStillInContainer) restoreOrder(container, current.originalIds, timers);
    } else {
      const ids = getTabs(container).map(tabId).filter((id) => id !== null);
      try { onReorder?.(ids); } catch { /* UI order is already committed */ }
    }

    const targetRect = tabStillInContainer ? current.tab.getBoundingClientRect() : current.startRect;
    let accepted = false;
    if (detached && !cancelled) {
      try {
        accepted = Boolean(await onDetach?.({
          tabId: current.id,
          screenX: current.screenX,
          screenY: current.screenY,
          clientX: current.clientX,
          clientY: current.clientY
        }));
      } catch { accepted = false; }
      if (!accepted && tabStillInContainer) restoreOrder(container, current.originalIds, timers);
    }

    current.tab.classList.remove("tab-dragging", "tab-drag-placeholder");
    settleGhost(current.ghost, targetRect, accepted, timers);
    try { onDragEnd?.(); } catch { /* optional host cleanup */ }
    try {
      if (current.pointerId != null && container.hasPointerCapture?.(current.pointerId)) {
        container.releasePointerCapture(current.pointerId);
      }
    } catch { /* pointer capture may already be released */ }
  };

  const finish = (cancelled = false) => {
    if (!pending && !drag) return;
    const current = drag || pending;
    const wasDragging = Boolean(drag);
    pending = null;
    drag = null;

    if (wasDragging) {
      void completeDrag(current, { cancelled, detached: current.detaching });
      suppressClick = true;
      clearTimeout(suppressTimer);
      suppressTimer = setTimeout(() => { suppressClick = false; }, 0);
    } else if (cancelled && current.tab.parentElement === container) {
      restoreOrder(container, current.originalIds, timers);
    }
  };

  const onPointerDown = (event) => {
    if (pending || drag) return;
    if (event.button !== 0 || event.target.closest?.(".tab-close")) return;
    const tab = event.target.closest?.(TAB_SELECTOR);
    if (!tab || tab.parentElement !== container) return;
    const id = tabId(tab);
    if (id === null) return;

    pending = {
      tab,
      id,
      startX: event.clientX,
      startY: event.clientY,
      clientX: event.clientX,
      clientY: event.clientY,
      screenX: event.screenX,
      screenY: event.screenY,
      pointerId: event.pointerId,
      originalIds: getTabs(container).map(tabId).filter((value) => value !== null)
    };
  };

  const onPointerMove = (event) => {
    const current = drag || pending;
    if (!current || current.pointerId !== event.pointerId) return;
    if (!drag) {
      if (Math.hypot(event.clientX - pending.startX, event.clientY - pending.startY) <= DRAG_THRESHOLD) return;
      drag = pending;
      pending = null;
      startDrag(drag);
    }

    drag.clientX = event.clientX;
    drag.clientY = event.clientY;
    drag.screenX = event.screenX;
    drag.screenY = event.screenY;
    moveGhost(drag);
    notifyDragMove(drag);

    const rect = container.getBoundingClientRect();
    const outside = drag.clientY < rect.top - VERTICAL_DETACH_MARGIN
      || drag.clientY > rect.bottom + VERTICAL_DETACH_MARGIN
      || drag.clientX < rect.left - HORIZONTAL_DETACH_MARGIN
      || drag.clientX > rect.right + HORIZONTAL_DETACH_MARGIN;
    if (outside && !drag.detaching) {
      drag.detaching = true;
      cancelFrame();
      restoreOrder(container, drag.originalIds, timers);
    } else if (!outside) {
      drag.detaching = false;
      reorderAt(container, drag.tab, drag.clientX, timers);
      if (drag.clientX < rect.left + EDGE_SIZE || drag.clientX > rect.right - EDGE_SIZE) scheduleFrame();
    }
  };

  const matchesPointer = (event) => (drag || pending)?.pointerId === event.pointerId;
  const onPointerUp = (event) => { if (matchesPointer(event)) finish(false); };
  const onPointerCancel = (event) => { if (matchesPointer(event)) finish(true); };
  const onLostPointerCapture = (event) => { if (matchesPointer(event)) finish(true); };
  const onWindowBlur = () => { if (!drag?.captured) finish(true); };
  const observer = typeof MutationObserver === "function"
    ? new MutationObserver(() => {
        const current = drag || pending;
        if (current && current.tab.parentElement !== container) finish(true);
      })
    : null;
  observer?.observe(container, { childList: true });
  const onKeyDown = (event) => { if (event.key === "Escape" && (pending || drag)) finish(true); };
  const onClick = (event) => {
    if (!suppressClick) return;
    suppressClick = false;
    clearTimeout(suppressTimer);
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  };

  container.addEventListener("pointerdown", onPointerDown);
  container.addEventListener("lostpointercapture", onLostPointerCapture);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerCancel);
  window.addEventListener("blur", onWindowBlur);
  container.addEventListener("click", onClick, true);
  window.addEventListener("keydown", onKeyDown);

  return () => {
    finish(true);
    container.removeEventListener("pointerdown", onPointerDown);
    container.removeEventListener("lostpointercapture", onLostPointerCapture);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerCancel);
    window.removeEventListener("blur", onWindowBlur);
    container.removeEventListener("click", onClick, true);
    window.removeEventListener("keydown", onKeyDown);
    observer?.disconnect();
    clearTimeout(suppressTimer);
    for (const timer of timers) clearTimeout(timer);
    document.querySelectorAll(".tab-drag-ghost").forEach((ghost) => ghost.remove());
  };
}
