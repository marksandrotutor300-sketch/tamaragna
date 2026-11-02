"use client";

const DB_NAME = "tamaragna-outbox";
const STORE = "care";

export type QueuedCare = {
  key: string;
  petId: string;
  action: string;
  createdAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function queueCareAction(
  petId: string,
  action: string,
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({
      key: crypto.randomUUID(),
      petId,
      action,
      createdAt: Date.now(),
    } satisfies QueuedCare);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function requestCareSync(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const sync = (
    registration as ServiceWorkerRegistration & {
      sync?: { register: (tag: string) => Promise<void> };
    }
  ).sync;
  if (sync) await sync.register("care-sync");
}
