import { openDB } from 'idb';

let dbInstance = null; // ✅ Cache DB instance

// Initialize DB (singleton pattern)
export const initDB = async () => {
  if (dbInstance) return dbInstance; // ✅ Reuse if already open

  dbInstance = await openDB('truckstop-inventory-db', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('inventory')) {
        const store = db.createObjectStore('inventory', { keyPath: '_id' });
        store.createIndex('lastUpdated', 'lastUpdated');
        store.createIndex('syncStatus', 'syncStatus');
      }
    }
  });

  console.log("✅ IndexedDB initialized in db.js");
  return dbInstance;
};

// Clear inventory store safely
export async function clearInventoryStore() {
  const db = await initDB();
  if (db.objectStoreNames.contains('inventory')) {
    await db.clear('inventory');
    console.log("🗑️ Cleared IndexedDB inventory store");
  } else {
    console.warn("⚠️ Tried to clear 'inventory' store, but it doesn't exist yet.");
  }
}

// Add new item (with unique temp ID if offline)
export const addItem = async (item) => {
  const db = await initDB();

  // Generate or use _id
  const itemId = item._id || `temp-${crypto.randomUUID()}`;

  // Defensive: avoid get() call if no ID
  if (!itemId) {
    console.error('❌ Cannot add item without a valid _id');
    return null;
  }

  // Check if item with same ID exists
  const existing = await db.get('inventory', itemId);
  if (existing) {
    console.log(`⚠️ Item with ID ${itemId} already exists. Skipping insert.`);
    return existing; // Prevent duplicate
  }

  const newItem = {
    ...item,
    _id: itemId,
    syncStatus: item.syncStatus || 'pending',
    lastUpdated: new Date().toISOString(),
  };

  await db.put('inventory', newItem);
  return newItem;
};

// Fetch all items
export const getAllItems = async () => {
  const db = await initDB();
  return db.getAll('inventory');
};

// Update item (marks as pending for sync)
export const updateItem = async (item) => {
  const db = await initDB();
  item.lastUpdated = new Date().toISOString();
  item.syncStatus = 'pending';
  await db.put('inventory', item);
  return item;
};

// Delete item by ID
export const deleteItem = async (id) => {
  const db = await initDB();
  await db.delete('inventory', id);
};