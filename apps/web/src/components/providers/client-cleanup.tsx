"use client";

import { useEffect } from "react";

const CLEANUP_KEY = "abc.cleanup.v1";

export function ClientCleanup() {
  useEffect(() => {
    const currentVersion = "2026-07-03-auth";
    if (window.localStorage.getItem(CLEANUP_KEY) === currentVersion) return;

    window.localStorage.setItem(CLEANUP_KEY, currentVersion);
    window.sessionStorage.removeItem("abc.csrfToken");

    if ("caches" in window) {
      void window.caches.keys().then((keys) => Promise.all(keys.map((key) => window.caches.delete(key))));
    }

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.getRegistrations().then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      );
    }
  }, []);

  return null;
}
