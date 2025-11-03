// src/utils/barcodeCache.js
// Barcode → { name, price, lastSeenAt, seenCount } (IDB)
// Bump DB_VER if you don't see the store created.
const DB_NAME = 'truckstop-db';
const DB_VER = 3;
const STORE = 'barcodeCache';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'barcode' });
        os.createIndex('lastSeenAt', 'lastSeenAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const p = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(p);
    t.onerror = () => reject(t.error);
  });
}

export async function getCachedBarcode(barcode) {
  if (!barcode) return null;
  return tx('readonly', (store) => new Promise((resolve, reject) => {
    const r = store.get(barcode);
    r.onsuccess = () => resolve(r.result || null);
    r.onerror = () => reject(r.error);
  }));
}

export async function upsertBarcode({ barcode, name, price }) {
  if (!barcode) return null;
  const now = new Date().toISOString();
  return tx('readwrite', (store) => new Promise((resolve, reject) => {
    const g = store.get(barcode);
    g.onsuccess = () => {
      const prev = g.result || { barcode, name: undefined, price: undefined, lastSeenAt: now, seenCount: 0 };
      const next = {
        ...prev,
        ...(name !== undefined ? { name } : {}),
        ...(price !== undefined ? { price } : {}),
        lastSeenAt: now,
        seenCount: (prev.seenCount || 0) + 1,
      };
      const p = store.put(next);
      p.onsuccess = () => resolve(next);
      p.onerror = () => reject(p.error);
    };
    g.onerror = () => reject(g.error);
  }));
}
