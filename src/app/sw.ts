import type { PrecacheEntry, RuntimeCaching } from "serwist";
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
} from "serwist";

type SWEvent = Event & {
  data?: { json(): unknown } | null;
  notification?: { close(): void; data?: unknown };
  tag?: string;
  waitUntil(promise: Promise<unknown>): void;
};

declare const self: {
  __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  registration: {
    showNotification(title: string, options?: NotificationOptions): Promise<void>;
  };
  clients: { openWindow(url: string): Promise<unknown> };
  addEventListener(type: string, listener: (event: SWEvent) => void): void;
};

const RO_ASSET_PREFIXES = ["/api/sprite/", "/api/icon/", "/api/map/"];

const runtimeCaching: RuntimeCaching[] = [
  // Ragnarok sprites, skill icons and map backdrops are immutable art. Cache
  // them aggressively so the ranch and arena still look right offline.
  {
    matcher: ({ sameOrigin, url }) =>
      sameOrigin && RO_ASSET_PREFIXES.some((prefix) => url.pathname.startsWith(prefix)),
    handler: new CacheFirst({
      cacheName: "tamaragna-ro-assets",
      plugins: [
        new ExpirationPlugin({
          maxEntries: 600,
          maxAgeSeconds: 60 * 60 * 24 * 30,
        }),
      ],
    }),
  },
  // Never cache game state. Care timers, battles and the roster are
  // server-authoritative and must not be served stale.
  {
    matcher: ({ sameOrigin, url }) => sameOrigin && url.pathname.startsWith("/api/"),
    handler: new NetworkOnly(),
  },
  // Pages get a short network-first window so a flaky phone connection can
  // still open a previously visited screen.
  {
    matcher: ({ sameOrigin, request }) => sameOrigin && request.destination === "document",
    handler: new NetworkFirst({
      cacheName: "tamaragna-pages",
      networkTimeoutSeconds: 4,
    }),
  },
  // Hashed Next assets and fonts.
  {
    matcher: ({ sameOrigin, url }) =>
      sameOrigin && /\.(?:js|css|woff2?|png|svg|webp|apng)$/i.test(url.pathname),
    handler: new StaleWhileRevalidate({ cacheName: "tamaragna-static" }),
  },
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();

type QueuedCare = {
  key: string;
  petId: string;
  action: string;
};

function openOutbox(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("tamaragna-outbox", 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("care")) {
        request.result.createObjectStore("care", { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deleteOutboxItem(key: string): Promise<void> {
  return openOutbox().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction("care", "readwrite");
        tx.objectStore("care").delete(key);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      }),
  );
}

async function flushCareOutbox(): Promise<void> {
  const db = await openOutbox();
  const items = await new Promise<QueuedCare[]>((resolve, reject) => {
    const tx = db.transaction("care", "readonly");
    const request = tx.objectStore("care").getAll();
    request.onsuccess = () => resolve(request.result as QueuedCare[]);
    request.onerror = () => reject(request.error);
  });
  db.close();

  for (const item of items) {
    try {
      const response = await fetch(`/api/pets/${item.petId}/care`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": item.key,
        },
        body: JSON.stringify({ action: item.action }),
      });
      if (
        response.ok ||
        response.status === 400 ||
        response.status === 401 ||
        response.status === 404 ||
        response.status === 422
      ) {
        await deleteOutboxItem(item.key);
      }
    } catch {
      // Still offline; the next sync attempt will retry.
    }
  }
}

self.addEventListener("push", (event) => {
  let data: {
    title?: string;
    body?: string;
    url?: string;
    tag?: string;
  } = {};
  try {
    data = (event.data?.json() ?? {}) as typeof data;
  } catch {
    // Ignore malformed push payloads.
  }

  event.waitUntil(
    self.registration.showNotification(data.title ?? "TamaRagna", {
      body: data.body ?? "Your ranch needs attention.",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag ?? "tamaragna",
      data: { url: data.url ?? "/ranch" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification?.close();
  const data = event.notification?.data as { url?: string } | undefined;
  event.waitUntil(self.clients.openWindow(data?.url ?? "/ranch"));
});

self.addEventListener("sync", (event) => {
  if (event.tag === "care-sync") event.waitUntil(flushCareOutbox());
});
