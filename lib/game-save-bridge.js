(function () {
  "use strict";

  const parent = window.parent;
  const gameId = document.documentElement.dataset.gamehubGameId || "unknown-game";
  let timer = null;

  const excluded = (key) =>
    !key ||
    key.startsWith("gamehub-") ||
    key.startsWith("sb-");

  function snapshot() {
    const storage = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (excluded(key)) continue;
      const value = localStorage.getItem(key);
      if (value !== null) storage[key] = value;
    }
    return storage;
  }

  function queueSave() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        parent.postMessage({
          type: "gamehub-storage-save",
          gameId,
          storage: snapshot()
        }, location.origin);
      } catch (error) {
        console.warn("[GameHub Save] Could not send autosave:", error);
      }
    }, 1500);
  }

  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;
  const originalClear = Storage.prototype.clear;

  Storage.prototype.setItem = function (key, value) {
    const result = originalSetItem.call(this, key, value);
    if (!excluded(String(key))) queueSave();
    return result;
  };

  Storage.prototype.removeItem = function (key) {
    const result = originalRemoveItem.call(this, key);
    if (!excluded(String(key))) queueSave();
    return result;
  };

  Storage.prototype.clear = function () {
    const result = originalClear.call(this);
    queueSave();
    return result;
  };

  window.addEventListener("beforeunload", () => {
    try {
      parent.postMessage({
        type: "gamehub-storage-save",
        gameId,
        storage: snapshot()
      }, location.origin);
    } catch (_) {}
  });

  console.log("[GameHub Save] Autosave bridge active for", gameId);
})();