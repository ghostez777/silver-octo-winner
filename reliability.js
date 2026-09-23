/* Reliability helpers for the game launcher.
 * Network/CDN failures should not leave the library or player blank.
 */
(function () {
  "use strict";

  const nativeFetch = window.fetch.bind(window);
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function hasValidCatalog(data) {
    try {
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      return Array.isArray(parsed);
    } catch (_) {
      return false;
    }
  }

  async function fetchWithRetry(input, options) {
    const request = typeof input === "string" ? input : input.url;
    const isCatalog = /(?:^|\/)games\.json(?:[?#]|$)/i.test(request);
    const attempts = isCatalog ? 4 : 2;
    let lastError;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), isCatalog ? 12000 : 20000);
      try {
        const result = await nativeFetch(input, {
          ...(options || {}),
          cache: isCatalog ? "no-store" : (options && options.cache),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (result.ok || attempt === attempts - 1) {
          if (isCatalog && result.ok) {
            const catalogText = await result.clone().text();
            if (hasValidCatalog(catalogText)) {
              try {
                localStorage.setItem("gamehub-games-cache", catalogText);
              } catch (_) { /* Storage may be disabled. */ }
              return new Response(catalogText, {
                status: result.status,
                statusText: result.statusText,
                headers: { "Content-Type": "application/json" },
              });
            }
            try {
              localStorage.removeItem("gamehub-games-cache");
            } catch (_) { /* Ignore storage issues. */ }
            console.warn("Game catalog was malformed; ignoring the response.");
          }
          return result;
        }
        lastError = new Error("Request returned " + result.status);
      } catch (error) {
        clearTimeout(timeout);
        lastError = error;
      }
      await sleep(350 * Math.pow(2, attempt));
    }

    if (isCatalog) {
      try {
        const cached = localStorage.getItem("gamehub-games-cache");
        if (cached && hasValidCatalog(cached)) {
          return new Response(cached, {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        localStorage.removeItem("gamehub-games-cache");
      } catch (_) { /* Continue to the original error. */ }
    }
    throw lastError || new Error("Request failed");
  }

  window.fetch = fetchWithRetry;

  function retryFrame(frame) {
    if (!frame || frame.dataset.retries === "3") return;
    const original = frame.dataset.gameUrl || frame.src;
    if (!original) return;
    const retries = Number(frame.dataset.retries || 0) + 1;
    frame.dataset.retries = String(retries);
    frame.dataset.gameUrl = original;
    frame.src = original + (original.includes("?") ? "&" : "?") + "retry=" + retries;
  }

  document.addEventListener("error", (event) => {
    const frame = event.target;
    if (frame && frame.tagName === "IFRAME") retryFrame(frame);
  }, true);

  document.addEventListener("load", (event) => {
    const frame = event.target;
    if (frame && frame.tagName === "IFRAME") {
      frame.dataset.gameUrl = frame.src;
      frame.dataset.retries = "0";
    }
  }, true);
})();
