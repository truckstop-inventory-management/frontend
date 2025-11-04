// src/utils/barcodeCache.js
// Barcode cache for local + remote enrichment, stored inside the EXISTING DB.
// This file ensures a 'barcodeCache' object store is present in the current DB
// (default name: 'truckstop-inventory-db'). If missing, it bumps the DB version
// and creates it — without touching your other stores (e.g., 'inventory').

let DB_NAME = 'truckstop-inventory-db'; // use your existing DB name
const STORE = 'barcodeCache';

/** Optional: set the DB name before initialization (if your app sets it elsewhere) */
export function setBarcodeCacheDbName(name) {
  if (typeof name === 'string' && name.trim()) DB_NAME = name.trim();
}

/** Open DB (optionally with version) with an upgrade handler that creates the store if needed */
function openWithOptionalVersion(version) {
  return new Promise((resolve, reject) => {
    const req = version ? indexedDB.open(DB_NAME, version) : indexedDB.open(DB_NAME);

    req.onupgradeneeded = () => {
      const db = req.result;
      // Create the store if it's not present yet
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'barcode' });
        if (!os.indexNames.contains('lastSeenAt')) {
          os.createIndex('lastSeenAt', 'lastSeenAt', { unique: false });
        }
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Ensure the barcodeCache store exists inside the current DB (creates via version bump if missing). */
async function ensureStoreExists() {
  // First open without forcing an upgrade, so we can inspect current version/stores.
  const db = await openWithOptionalVersion();
  if (db.objectStoreNames.contains(STORE)) return db;

  // Store missing → bump version by 1 to trigger onupgradeneeded and create the store.
  const nextVersion = db.version + 1 || 1;
  db.close();
  const upgraded = await openWithOptionalVersion(nextVersion);
  return upgraded;
}

/** Main open used by helpers below */
function openDB() {
  return ensureStoreExists();
}

async function tx(mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const result = fn(store);
    t.oncomplete = () => resolve(result);
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
      const prev = g.result || {
        barcode,
        name: undefined,
        price: undefined,
        brand: '',
        category: '',
        source: 'local',
        lastSeenAt: now,
        lastFetchedAt: '',
        seenCount: 0,
      };
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

export async function updateBarcodeFields(barcode, patch) {
  if (!barcode || !patch || typeof patch !== 'object') return null;
  return tx('readwrite', (store) => new Promise((resolve, reject) => {
    const g = store.get(barcode);
    g.onsuccess = () => {
      const prev = g.result || { barcode, seenCount: 0 };
      const next = { ...prev, ...patch };
      const p = store.put(next);
      p.onsuccess = () => resolve(next);
      p.onerror = () => reject(p.error);
    };
    g.onerror = () => reject(g.error);
  }));
}

export async function upsertRemoteEnrichment(barcode, remote) {
  if (!barcode || !remote) return null;
  const now = new Date().toISOString();
  const patch = {
    ...(remote.name !== undefined ? { name: remote.name } : {}),
    ...(remote.price !== undefined ? { price: remote.price } : {}),
    ...(remote.brand !== undefined ? { brand: remote.brand } : {}),
    ...(remote.category !== undefined ? { category: remote.category } : {}),
    source: 'remote',
    lastFetchedAt: now,
  };
  return updateBarcodeFields(barcode, patch);
}

/**
 * Call once at app startup to ensure the store exists inside the EXISTING DB.
 * This does NOT migrate or copy between DBs; it only adds the store to the
 * current DB if it isn't there yet.
 */
export async function ensureBarcodeCacheInitialized() {
  try {
    await ensureStoreExists();
  } catch (e) {
    // non-fatal; the app can still run without cache
    console.warn('[barcodeCache] init failed:', e);
  }
}
