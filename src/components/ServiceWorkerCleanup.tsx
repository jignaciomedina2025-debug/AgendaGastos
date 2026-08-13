"use client";

import { useEffect } from "react";

/**
 * Removes broken/legacy service workers from earlier PWA builds
 * that precached Cloudflare `/_headers` and served stale JS.
 */
export function ServiceWorkerCleanup() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    void (async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));

      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    })();
  }, []);

  return null;
}
