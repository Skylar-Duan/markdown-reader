const TAB_SELECTOR = ".tab[data-tab-id]";
const DRAG_THRESHOLD = 5;
const EDGE_SIZE = 32;
const SCROLL_STEP = 12;

function getTabs(container) {
  return [...container.children].filter((el) => el.matches?.(TAB_SELECTOR));
}

function tabId(tab) {
  const id = Number(tab.dataset.tabId);
  return Number.isFinite(id) ? id : null;
}

function reorderAt(container, dragged, clientX) {
  const others = getTabs(container).filter((tab) => tab !== dragged);
  const before = others.find((tab) => {
    const rect = tab.getBoundingClientRect();
    return clientX < rect.left + rect.width / 2;
  });

  if (before) container.insertBefore(dragged, before);
  else if (others.length) container.insertBefore(dragged, others[others.length - 1].nextSibling);
}

/** Enable pointer-based reordering for tab elements inside a renderable container. */
export function setupTabReorder(container, { onReorder } = {}) {
  let pending = null;
  let drag = null;
  let suppressClick = false;
  let suppressTimer = null;
  let frame = null;

  const cancelFrame = () => {
    if (frame === null) return;
    if (typeof window.cancelAnimationFrame === "function") window.cancelAnimationFrame(frame);
    else clearTimeout(frame);
    frame = null;
  };

  const scheduleFrame = () => {
    if (frame !== null || !drag) return;
    const tick = () => {
      frame = null;
      if (!drag) return;
      const rect = container.getBoundingClientRect();
      if (drag.clientX < rect.left + EDGE_SIZE) {
        container.scrollLeft -= SCROLL_STEP;
      } else if (drag.clientX > rect.right - EDGE_SIZE) {
        container.scrollLeft += SCROLL_STEP;
      } else {
        return;
      }
      reorderAt(container, drag.tab, drag.clientX);
      scheduleFrame();
    };
    frame = typeof window.requestAnimationFrame === "function"
      ? window.requestAnimationFrame(tick)
      : setTimeout(tick, 16);
  };

  const finish = (cancelled = false) => {
    if (!pending && !drag) return;
    const wasDragging = Boolean(drag);
    const current = drag || pending;
    cancelFrame();
    pending = null;
    drag = null;

    if (wasDragging) current.tab.classList.remove("tab-dragging");
    if (cancelled) {
      if (current?.originalIds && current.tab.parentElement === container) {
        const currentTabs = new Map(getTabs(container).map((tab) => [tabId(tab), tab]));
        for (const id of current.originalIds) {
          const tab = currentTabs.get(id);
          if (tab) container.appendChild(tab);
        }
      }
    } else if (wasDragging) {
      const ids = getTabs(container).map(tabId).filter((id) => id !== null);
      onReorder?.(ids);
    }

    try {
      if (current?.pointerId != null && container.hasPointerCapture?.(current.pointerId)) {
        container.releasePointerCapture(current.pointerId);
      }
    } catch { /* capture may already be released */ }

    if (wasDragging) {
      suppressClick = true;
      clearTimeout(suppressTimer);
      suppressTimer = setTimeout(() => { suppressClick = false; }, 0);
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
      pointerId: event.pointerId,
      originalIds: getTabs(container).map(tabId).filter((value) => value !== null)
    };
  };

  const onPointerMove = (event) => {
    if (!pending && !drag) return;
    if ((drag || pending).pointerId !== event.pointerId) return;
    if (!drag) {
      const dx = event.clientX - pending.startX;
      const dy = event.clientY - pending.startY;
      if (Math.hypot(dx, dy) <= DRAG_THRESHOLD) return;
      drag = pending;
      pending = null;
      drag.tab.classList.add("tab-dragging");
      try {
        if (drag.pointerId != null) container.setPointerCapture?.(drag.pointerId);
      } catch { /* capture may be unavailable */ }
    }
    drag.clientX = event.clientX;
    drag.clientY = event.clientY;
    reorderAt(container, drag.tab, drag.clientX);
    const rect = container.getBoundingClientRect();
    if (drag.clientX < rect.left + EDGE_SIZE || drag.clientX > rect.right - EDGE_SIZE) scheduleFrame();
  };

  const matchesPointer = (event) => (drag || pending)?.pointerId === event.pointerId;
  const onPointerUp = (event) => { if (matchesPointer(event)) finish(false); };
  const onPointerCancel = (event) => { if (matchesPointer(event)) finish(true); };
  const onLostPointerCapture = (event) => { if (matchesPointer(event)) finish(true); };
  const onWindowBlur = () => finish(true);
  const observer = typeof MutationObserver === "function"
    ? new MutationObserver(() => {
        const current = drag || pending;
        if (current && current.tab.parentElement !== container) finish(true);
      })
    : null;
  observer?.observe(container, { childList: true });
  const onKeyDown = (event) => {
    if (event.key === "Escape" && (pending || drag)) finish(true);
  };
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
  };
}
