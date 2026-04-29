// toc.js — Table of Contents extraction and rendering

export function extractTOC(html) {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const headings = doc.querySelectorAll("h1, h2, h3, h4, h5, h6");
  return Array.from(headings).map(h => ({
    id: h.id,
    depth: parseInt(h.tagName.substring(1), 10),
    text: h.textContent.trim()
  }));
}

export function renderTOC(items, container, options = {}) {
  if (!container) return;
  container.innerHTML = "";
  if (!items || items.length === 0) {
    if (options.emptyText) {
      const li = document.createElement("li");
      li.className = "toc-item";
      li.style.color = "var(--text-tertiary)";
      li.style.fontStyle = "italic";
      li.style.cursor = "default";
      li.textContent = options.emptyText;
      container.appendChild(li);
    }
    return;
  }
  items.forEach(item => {
    if (!item.id) return;
    const li = document.createElement("li");
    li.className = `toc-item toc-h${item.depth}`;
    li.textContent = item.text;
    li.title = item.text;
    li.dataset.targetId = item.id;
    li.addEventListener("click", () => {
      const target = document.getElementById(item.id);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        container.querySelectorAll(".toc-item").forEach(i => i.classList.remove("active"));
        li.classList.add("active");
      }
    });
    container.appendChild(li);
  });
}

// Update active TOC item based on scroll position
export function setupScrollSpy(contentEl, tocContainer) {
  if (!contentEl || !tocContainer) return;

  let ticking = false;

  function updateActive() {
    const headings = contentEl.querySelectorAll("h1, h2, h3, h4, h5, h6");
    const scrollTop = contentEl.scrollTop;
    const offset = 80;
    let active = null;

    headings.forEach(h => {
      if (h.offsetTop - offset <= scrollTop) {
        active = h.id;
      }
    });

    if (active) {
      tocContainer.querySelectorAll(".toc-item").forEach(i => {
        i.classList.toggle("active", i.dataset.targetId === active);
      });
    }
    ticking = false;
  }

  contentEl.addEventListener("scroll", () => {
    if (!ticking) {
      requestAnimationFrame(updateActive);
      ticking = true;
    }
  });
}
