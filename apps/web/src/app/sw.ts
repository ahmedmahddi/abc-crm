/// <reference lib="webworker" />

import { CacheFirst, ExpirationPlugin, NetworkFirst, Serwist, StaleWhileRevalidate } from "serwist";
import type { RouteMatchCallbackOptions } from "serwist";
import { defaultCache } from "@serwist/next/worker";

declare global {
  interface WorkerGlobalScope {
    __SW_MANIFEST: Array<{ revision: string | null; url: string }>;
  }
}

declare const self: ServiceWorkerGlobalScope & WorkerGlobalScope;

const serwist = new Serwist({
  clientsClaim: true,
  navigationPreload: true,
  precacheEntries: self.__SW_MANIFEST,
  runtimeCaching: [
    ...defaultCache,
    {
      matcher: ({ request, sameOrigin }: RouteMatchCallbackOptions) =>
        sameOrigin && request.mode === "navigate",
      handler: new NetworkFirst({
        cacheName: "abc-crm-pages",
        networkTimeoutSeconds: 4,
      }),
    },
    {
      matcher: ({ request, sameOrigin }: RouteMatchCallbackOptions) =>
        sameOrigin && request.destination === "image",
      handler: new CacheFirst({
        cacheName: "abc-crm-images",
        plugins: [new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 })],
      }),
    },
    {
      matcher: ({ request, sameOrigin }: RouteMatchCallbackOptions) =>
        sameOrigin && ["font", "script", "style"].includes(request.destination),
      handler: new StaleWhileRevalidate({
        cacheName: "abc-crm-static",
        plugins: [new ExpirationPlugin({ maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 })],
      }),
    },
  ],
  skipWaiting: true,
});

serwist.addEventListeners();

self.addEventListener("push", (event) => {
  const payload = parsePushPayload(event);
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      data: { url: payload.url ?? "/" },
      icon: "/brand/logo-fb.png",
      badge: "/brand/logo-fb.png",
      tag: payload.tag,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = typeof event.notification.data?.url === "string" ? event.notification.data.url : "/";
  event.waitUntil(self.clients.openWindow(url));
});

function parsePushPayload(event: PushEvent) {
  const fallback = { title: "ABC CRM", body: "Nouvelle notification", url: "/", tag: "abc-crm" };
  if (!event.data) return fallback;
  try {
    return { ...fallback, ...event.data.json() } as typeof fallback;
  } catch {
    return { ...fallback, body: event.data.text() };
  }
}
