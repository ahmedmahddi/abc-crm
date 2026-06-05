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
