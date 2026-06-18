// Minimal service worker to satisfy PWA installability requirements
// (Chrome/Android need a registered SW with a fetch handler).
// Intentionally does NOT cache anything — pure pass-through to the network.

const VERSION = "v2";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Pass-through fetch handler (required for installability).
self.addEventListener("fetch", (event) => {
  // Let the browser handle everything normally.
  return;
});
