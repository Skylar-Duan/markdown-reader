// search.js — Ctrl+F find with highlight + nav

export class Search {
  constructor(i18n) {
    this.i18n = i18n;
    this.overlay = null;
    this.matches = [];
    this.current = -1;
  }

  open() {
    if (this.overlay) {
      this.overlay.querySelector(".search-input").focus();
      this.overlay.querySelector(".search-input").select();
      return;
    }
    this.overlay = document.createElement("div");
    this.overlay.className = "search-overlay";
    this.overlay.innerHTML = `
      <input type="text" class="search-input" placeholder="${this.i18n.t("search.placeholder")}" />
      <span class="search-count"></span>
      <button class="search-prev" title="Previous">↑</button>
      <button class="search-next" title="Next">↓</button>
      <button class="search-close" title="Close">✕</button>
    `;
    document.body.appendChild(this.overlay);
    const input = this.overlay.querySelector(".search-input");
    input.focus();

    input.addEventListener("input", () => this.find(input.value));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) this.prev(); else this.next();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        this.close();
      }
    });
    this.overlay.querySelector(".search-prev").addEventListener("click", () => this.prev());
    this.overlay.querySelector(".search-next").addEventListener("click", () => this.next());
    this.overlay.querySelector(".search-close").addEventListener("click", () => this.close());
  }

  find(query) {
    this.clearHighlights();
    this.matches = [];
    this.current = -1;
    if (!query) {
      this.updateCount();
      return;
    }

    const root = document.getElementById("renderer-output");
    if (!root || root.hidden) {
      this.updateCount();
      return;
    }

    // Collect text nodes (snapshot before mutation)
    const textNodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.parentElement) return NodeFilter.FILTER_REJECT;
        if (node.parentElement.closest(".search-highlight")) return NodeFilter.FILTER_REJECT;
        if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let n;
    while ((n = walker.nextNode())) textNodes.push(n);

    const re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");

    textNodes.forEach(node => {
      const text = node.nodeValue;
      const ranges = [];
      let m;
      re.lastIndex = 0;
      while ((m = re.exec(text)) !== null) {
        ranges.push([m.index, m.index + m[0].length]);
        if (m.index === re.lastIndex) re.lastIndex++; // empty-match guard
      }
      if (ranges.length === 0) return;

      const frag = document.createDocumentFragment();
      let lastIdx = 0;
      ranges.forEach(([s, e]) => {
        if (s > lastIdx) frag.appendChild(document.createTextNode(text.slice(lastIdx, s)));
        const span = document.createElement("span");
        span.className = "search-highlight";
        span.textContent = text.slice(s, e);
        frag.appendChild(span);
        this.matches.push(span);
        lastIdx = e;
      });
      if (lastIdx < text.length) frag.appendChild(document.createTextNode(text.slice(lastIdx)));
      node.parentNode.replaceChild(frag, node);
    });

    if (this.matches.length > 0) {
      this.current = 0;
      this.scrollToCurrent();
    }
    this.updateCount();
  }

  next() {
    if (this.matches.length === 0) return;
    this.current = (this.current + 1) % this.matches.length;
    this.scrollToCurrent();
    this.updateCount();
  }

  prev() {
    if (this.matches.length === 0) return;
    this.current = (this.current - 1 + this.matches.length) % this.matches.length;
    this.scrollToCurrent();
    this.updateCount();
  }

  scrollToCurrent() {
    this.matches.forEach(m => m.classList.remove("active"));
    const el = this.matches[this.current];
    el.classList.add("active");
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  updateCount() {
    if (!this.overlay) return;
    const count = this.overlay.querySelector(".search-count");
    if (this.matches.length === 0) {
      count.textContent = this.i18n.t("search.no_results");
    } else {
      count.textContent = this.i18n.t("search.results", {
        current: this.current + 1,
        total: this.matches.length
      });
    }
  }

  clearHighlights() {
    document.querySelectorAll(".search-highlight").forEach(span => {
      const text = document.createTextNode(span.textContent);
      span.parentNode.replaceChild(text, span);
    });
    const root = document.getElementById("renderer-output");
    if (root) root.normalize();
  }

  close() {
    this.clearHighlights();
    this.overlay?.remove();
    this.overlay = null;
    this.matches = [];
    this.current = -1;
  }
}
