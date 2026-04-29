// toast.js — bottom-center transient notifications

export function toast(message, kind = "info", duration = 2800) {
  const t = document.createElement("div");
  t.className = `toast ${kind}`;
  t.textContent = message;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), duration);
}
