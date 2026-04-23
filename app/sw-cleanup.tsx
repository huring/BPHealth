"use client";

import { useEffect } from "react";

export function ServiceWorkerCleanup() {
  useEffect(() => {
    async function cleanup() {
      if (!("serviceWorker" in navigator)) {
        return;
      }

      try {
        const registrations = await navigator.serviceWorker.getRegistrations();

        await Promise.all(registrations.map((registration) => registration.unregister()));

        if (typeof caches !== "undefined") {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
        }
      } catch {
        // Keep the app usable even if cleanup fails.
      }
    }

    void cleanup();

    return () => {
      // Nothing to clean up; this effect runs once on mount.
    };
  }, []);

  return null;
}
