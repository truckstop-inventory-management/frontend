// src/utils/db.js
import { openDB } from 'idb';

let dbInstance = null;

// Open the ORIGINAL DB that already has your data
export async function initDB() {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB('truckstop-inventory-db', 2, {
    upgrade(db, _oldVersion, _newVersion, tx) {
      if (!db.objectStoreNames.contains('inventory')) {
        const store = db.createObjectStore('inventory', { keyPath: '_id' });
        store.createIndex('lastUpdated', 'lastUpdated');
        store.createIndex('syncStatus', 'syncStatus');
        store.createIndex('isDeleted', 'isDeleted');
      } else {
        // Ensure indexes exist after version bumps
        const store = tx.objectStore('inventory');
        if (!store.indexNames.contains('isDeleted')) {
          store.createIndex('isDeleted', 'isDeleted');
        }
        if (!store.indexNames.contains('syncStatus')) {
          store.createIndex('syncStatus', 'syncStatus');
        }
        if (!store.indexNames.contains('lastUpdated')) {
          store.createIndex('lastUpdated', 'lastUpdated');
        }
      }
    },
  });

  console.log('✅ IndexedDB initialized (truckstop-inventory-db)');
  return dbInstance;
}

// Raw read
export async function getAllItems() {
  const db = await initDB();
  return db.getAll('inventory');
}

// Only active (not tombstoned)
export async function getActiveItems() {
  const db = await initDB();
  const all = await db.getAll('inventory');
  return all.filter((item) => !item.isDeleted);
}

// Pending non-deleted items
export async function getPendingItems() {
  const db = await initDB();
  const all = await db.getAll('inventory');
  return all.filter((item) => item.syncStatus === 'pending' && !item.isDeleted);
}

// Tombstones awaiting server delete
export async function getPendingDeletedItems() {
  const db = await initDB();
  const all = await db.getAll('inventory');
  return all.filter((item) => item.isDeleted && item.syncStatus === 'pending');
}

// Insert or no-op if exists
export async function addItem(raw) {
  const db = await initDB();
  const tx = db.transaction('inventory', 'readwrite');
  const store = tx.objectStore('inventory');

  const _id = raw?._id || `local_${crypto.randomUUID()}`;
  const quantity = Number.isFinite(Number(raw?.quantity)) ? Number(raw.quantity) : 0;
  const price = Number.isFinite(Number(raw?.price)) ? Number(raw.price) : 0;

  const doc = {
    _id,
    itemName: String(raw?.itemName || '').trim(),
    quantity,
    price,
    location: String(raw?.location || '').trim(),
    // 🔽 preserve if provided, else default
    isDeleted: typeof raw?.isDeleted === 'boolean' ? raw.isDeleted : false,
    syncStatus: raw?.syncStatus || 'pending',
    conflictServer: raw?.conflictServer ?? null,
    lastUpdated: raw?.lastUpdated
      ? new Date(raw.lastUpdated).toISOString()
      : new Date().toISOString(),
  };

  await store.put(doc);
  await tx.done;
  return doc;
}

// Upsert with guaranteed lastUpdated
export async function updateItem(item) {
  const db = await initDB();
  const toPut = {
    ...item,
    lastUpdated: item.lastUpdated ?? new Date().toISOString(),
  };
  await db.put('inventory', toPut);
  console.log(
    `[IDB] updateItem -> _id=${toPut._id}, syncStatus=${toPut.syncStatus}, isDeleted=${toPut.isDeleted}`
  );
  return toPut;
}

// Tombstone local delete
export async function markItemDeleted(id) {
  const db = await initDB();
  const tx = db.transaction('inventory', 'readwrite');
  const store = tx.objectStore('inventory');
  const existing = await store.get(id);
  if (!existing) {
    console.warn(`[IDB] markItemDeleted -> no item found for _id=${id}`);
    await tx.done;
    return;
  }
  const next = {
    ...existing,
    isDeleted: true,
    syncStatus: 'pending',
    lastUpdated: new Date().toISOString(),
  };
  await store.put(next);
  await tx.done;
  console.log(`[IDB] markItemDeleted -> _id=${id} (tombstoned)`);
  return next;
}

// Hard delete (utility)
export async function deleteItem(id) {
  const db = await initDB();
  await db.delete('inventory', id);
  console.log(`[IDB] deleteItem -> _id=${id}`);
}

// Purge tombstones that are now synced
export async function purgeDeletedSynced() {
  const db = await initDB();
  const all = await db.getAll('inventory');
  const deletable = all.filter((it) => it.isDeleted && it.syncStatus === 'synced');
  for (const it of deletable) {
    await db.delete('inventory', it._id);
    console.log(`[IDB] purge tombstone -> _id=${it._id}`);
  }
}

// Record a 409 conflict with server copy snapshot
export async function markConflict(id, serverCopy) {
  const db = await initDB();
  const tx = db.transaction('inventory', 'readwrite');
  const store = tx.objectStore('inventory');
  const existing = await store.get(id);
  if (!existing) {
    await tx.done;
    return;
  }
  await store.put({
    ...existing,
    syncStatus: 'conflict',
    conflictServer: serverCopy,
  });
  await tx.done;
  console.log(`[IDB] markConflict -> _id=${id} set to conflict`);
}

/**
 * Remap a temporary local id (e.g., "local_...") to the server ObjectId atomically.
 * Prevents duplicate rows during create/upsert flows.
 */
export async function remapLocalId(oldId, newId, serverDoc = {}) {
  const db = await initDB();
  const tx = db.transaction('inventory', 'readwrite');
  const store = tx.objectStore('inventory');

  const existing = await store.get(oldId);
  if (!existing) {
    await tx.done;
    return null;
  }

  const next = {
    ...existing,
    ...serverDoc,           // prefer any fields returned by server
    _id: newId,             // swap to server ObjectId
    syncStatus: 'synced',
    conflictServer: null,
    lastUpdated: new Date().toISOString(),
  };

  await store.delete(oldId); // remove the temp-keyed record
  await store.put(next);     // write with the real server _id
  await tx.done;

  console.log(`[IDB] remapLocalId -> ${oldId} ➝ ${newId}`);
  return next;
}