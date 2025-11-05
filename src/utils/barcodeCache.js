// src/utils/barcodeCache.js
// Barcode cache for local + remote enrichment, stored inside the EXISTING DB.
// This file ensures a 'barcodeCache' object store is present in the current DB
// (default name: 'truckstop-inventory-db'). If missing, it bumps the DB version
// and creates it — without touching your other stores (e.g., 'inventory').

let DB_NAME = 'truckstop-inventory-db'; // use your existing DB name
const STORE = 'barcodeCache';

// ---- logging helpers --------------------------------------------------------
const log = (...args) => console.log('[barcodeCache]', ...args);
const warn = (...args) => console.warn('[barcodeCache]', ...args);
const err = (...args) => console.error('[barcodeCache]', ...args);

/** Optional: set the DB name before initialization (if your app sets it elsewhere) */
export function setBarcodeCacheDbName(name) {
  if (typeof name === 'string' && name.trim()) {
    DB_NAME = name.trim();
    log('DB_NAME set to', DB_NAME);
  }
}

/** Small helper: describe objectStoreNames as an array for logs */
function listStoreNames(db) {
  return Array.from(db.objectStoreNames || []);
}

/** Open DB (optionally with version) with an upgrade handler that creates the store if needed */
function openWithOptionalVersion(version, { verbose = false } = {}) {
  return new Promise((resolve, reject) => {
    const req = version ? indexedDB.open(DB_NAME, version) : indexedDB.open(DB_NAME);

    if (verbose) {
      req.onblocked = () => {
        warn('open blocked (another tab/connection holds an older version). Waiting for close…');
      };
    } else {
      req.onblocked = () => {};
    }

    req.onupgradeneeded = () => {
      const db = req.result;
      const before = listStoreNames(db);
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'barcode' });
        if (!os.indexNames.contains('lastSeenAt')) {
          os.createIndex('lastSeenAt', 'lastSeenAt', { unique: false });
        }
        if (verbose) {
          log(`onupgradeneeded → created store "${STORE}". Stores before=${JSON.stringify(before)} after=${JSON.stringify(listStoreNames(db))}`);
        }
      } else if (verbose) {
        log(`onupgradeneeded → "${STORE}" already present.`);
      }

      // If other connections to this DB exist, ask them to close.
      db.onversionchange = () => {
        warn('versionchange on upgraded connection → closing');
        db.close();
      };
    };

    req.onsuccess = () => {
      const db = req.result;
      if (verbose) {
        log(`open success → name=${db.name} version=${db.version} stores=${JSON.stringify(listStoreNames(db))}`);
      }
      // Ensure we close this connection if someone else tries to upgrade later.
      db.onversionchange = () => {
        warn('versionchange on open connection → closing');
        db.close();
      };
      resolve(db);
    };

    req.onerror = () => {
      err('open error:', req.error);
      reject(req.error);
    };
  });
}

/** Attempt an upgrade with retries to handle onblocked cases gracefully */
async function upgradeWithRetries(nextVersion, { retries = 3, delayMs = 300 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      log(`upgrade attempt ${attempt}/${retries} → opening ${DB_NAME} @ version ${nextVersion}`);
      const db = await openWithOptionalVersion(nextVersion, { verbose: true });
      return db; // success
    } catch (e) {
      warn(`upgrade attempt ${attempt} failed:`, e);
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, delayMs * attempt)); // backoff
      } else {
        throw e;
      }
    }
  }
}

/** Ensure the barcodeCache store exists inside the current DB (creates via version bump if missing). */
async function ensureStoreExists() {
  // First open without forcing an upgrade, so we can inspect current version/stores.
  const db = await openWithOptionalVersion(undefined, { verbose: true });
  const hasStore = db.objectStoreNames.contains(STORE);
  if (hasStore) {
    log(`"${STORE}" present @ version ${db.version}.`);
    return db;
  }

  // Store missing → bump version by 1 to trigger onupgradeneeded and create the store.
  const nextVersion = (db.version || 0) + 1;
  log(`"${STORE}" missing. Will bump version from ${db.version} → ${nextVersion} to create it.`);
  db.close();

  const upgraded = await upgradeWithRetries(nextVersion, { retries: 5, delayMs: 350 });
  if (!upgraded.objectStoreNames.contains(STORE)) {
    // Extremely unlikely: upgrade succeeded but store still missing.
    upgraded.close();
    throw new Error(`Upgrade completed but "${STORE}" still not found.`);
  }
  log(`Upgrade completed. "${STORE}" now present @ version ${upgraded.version}.`);
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
    let out;
    try {
      out = fn(store);
    } catch (e) {
      reject(e);
      return;
    }
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Transaction aborted'));
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
    log('init → ensuring store exists');
    const db = await ensureStoreExists();
    // keep the connection open briefly to reduce immediate re-open churn, then close
    setTimeout(() => {
      try {
        db.close();
        log('init → closed initial connection');
      } catch {}
    }, 0);
  } catch (e) {
    // non-fatal; the app can still run without cache
    warn('init failed:', e);
  }
}

/** DEV-ONLY: helper to wipe the DB from console during hard-reset tests */
export function __devDeleteDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => { log('deleteDatabase success'); resolve(); };
    req.onerror = () => { err('deleteDatabase error:', req.error); reject(req.error); };
    req.onblocked = () => { warn('deleteDatabase blocked — close other tabs/instances'); };
  });
}
