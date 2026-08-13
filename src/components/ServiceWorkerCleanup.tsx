"use client";

import { useEffect } from "react";

/**
 * Forces browsers off the broken Workbox SW:
 * 1) registers the kill-switch /sw.js
 * 2) unregisters every SW
 * 3) clears Cache Storage
 */
export function ServiceWorkerCleanup() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    void (async () => {
      try {
        // Install kill-switch first so activate handler can clear caches.
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch {
        // ignore register failures; still try to unregister below
      }

      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map((registration) => registration.unregister()),
      );

      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    })();
  }, []);

  return null;
}
