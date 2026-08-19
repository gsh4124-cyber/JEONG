"use client";

import { useEffect } from "react";

/** Keep development free of stale application-shell caches. */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      // A service worker installed by an older production run can survive on localhost
      // and serve stale JS/CSS while developing. Remove only JEONG shell caches here;
      // user data lives in LocalStorage and is never touched.
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => void registration.unregister());
      }).catch(() => undefined);
      if ("caches" in window) {
        caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("jeong-shell-")).map((key) => caches.delete(key)))).catch(() => undefined);
      }
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline support is progressive enhancement; the app remains usable online.
    });
  }, []);

  return null;
}
