import {
  CacheFirst,
  NetworkFirst,
  NetworkOnly,
  StaleWhileRevalidate,
  ExpirationPlugin,
  Serwist,
} from "serwist";

declare const self: Window &
  typeof globalThis & {
    __SW_MANIFEST: (string | { url: string; revision: string | null })[];
  };

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [
    {
      matcher: /^\/api\/.*/i,
      handler: new NetworkOnly(),
    },
    {
      matcher: /\/recipes\/.*/i,
      handler: new StaleWhileRevalidate({
        cacheName: "recipes",
        plugins: [
          new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 }),
        ],
      }),
    },
    {
      matcher: /\.(png|jpg|jpeg|svg|gif|webp|ico)$/i,
      handler: new CacheFirst({
        cacheName: "images",
        plugins: [
          new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }),
        ],
      }),
    },
    {
      matcher: /^\/.*$/i,
      handler: new NetworkFirst({
        cacheName: "pages",
        plugins: [
          new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 7 * 24 * 60 * 60 }),
        ],
        networkTimeoutSeconds: 10,
      }),
    },
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline.html",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
