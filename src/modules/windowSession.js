import { SESSION_KEY, readSession, writeSession } from "./session.js";

const PREFIX = "md-reader.window-session.";

// All native windows share the origin, so each writes its own small snapshot.
// Only their combined saved-file metadata becomes the next cold-start session.
export function createWindowSession(label, coldStart, storage = localStorage) {
  try {
    if (coldStart) for (const key of Object.keys(storage)) if (key.startsWith(PREFIX)) storage.removeItem(key);
  } catch { /* Denied storage never blocks the editor. */ }
  function combine(activeLabel) {
    try {
      const records = Object.keys(storage).filter(key => key.startsWith(PREFIX)).sort();
      const tabs = [];
      let activeId;
      for (const key of records) {
        const session = readSession({ getItem: () => storage.getItem(key) });
        if (!session) continue;
        session.tabs.forEach((tab, index) => {
          const id = `${key}:${index}`;
          tabs.push({ ...tab, id });
          if (key === PREFIX + activeLabel && index === session.activeIndex) activeId = id;
        });
      }
      writeSession(tabs, activeId, storage);
    } catch { /* Best effort, as with the original session store. */ }
  }
  return {
    save(tabs, activeId) {
      const proxy = {
        setItem: (_key, value) => storage.setItem(PREFIX + label, value),
        removeItem: () => storage.removeItem(PREFIX + label),
      };
      writeSession(tabs, activeId, proxy);
      combine(label);
    },
    remove(otherLabel) {
      try { storage.removeItem(PREFIX + otherLabel); } catch { return; }
      combine(label);
    },
  };
}
