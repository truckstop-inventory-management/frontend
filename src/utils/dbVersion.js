// src/utils/dbVersion.js
// Single source of truth for DB name + safe open helpers (no hard-coded versions)

export const DB_NAME = 'truckstop-inventory-db';

/** Open without a target version just to read the live version. */
export function getCurrentDbVersion() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME); // no version → read-only open
    req.onsuccess = () => {
      const v = req.result.version || 0;
      // close immediately; this is only for discovery
      try { req.result.close(); } catch {}
      resolve(v);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Open at an explicit version with a supplied upgrade callback.
 * - upgradeFn(db, oldVersion, newVersion, transaction)
 */
export function openWithVersion(version, upgradeFn) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, version);

    req.onupgradeneeded = (ev) => {
      const db = req.result;
      const { oldVersion, newVersion, transaction } = ev;
      if (typeof upgradeFn === 'function') {
        upgradeFn(db, oldVersion, newVersion, transaction);
      }
      // In case other tabs are open:
      db.onversionchange = () => db.close();
    };

    req.onblocked = () => {
      // You can add logging here if you want
    };

    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };

    req.onerror = () => reject(req.error);
  });
}

/**
 * Open the DB at **at least** the given version.
 * If the live DB is older, this bumps to targetVersion and triggers upgradeFn.
 * If the live DB is newer, it simply opens at the live version (no downgrade).
 */
export async function openAtLeastVersion(targetVersion, upgradeFn) {
  const live = await getCurrentDbVersion();
  const version = Math.max(live, targetVersion);
  return openWithVersion(version, upgradeFn);
}
