import React, { useEffect, useState } from "react";
import { initDB, getAllItems, addItem, updateItem, deleteItem, clearInventoryStore } from "../utils/db";
import axios from 'axios';

export default function InventoryList({ token }) {
  const [inventory, setInventory] = useState([]);
  const [newItem, setNewItem] = useState({ itemName: '', quantity: '', price: '', location: '' });
  const [dbReady, setDbReady] = useState(false); // ✅ Track DB readiness

  // Initialize DB before anything else
  useEffect(() => {
    const prepareDB = async () => {
      await initDB();
      console.log("✅ IndexedDB is ready for use in InventoryList");
      setDbReady(true);
    };
    prepareDB();
  }, []);

  // Load inventory (sync online or offline)
  useEffect(() => {
    if (!dbReady) return; // 🚫 Stop until DB is initialized

    const loadInventory = async () => {
      if (navigator.onLine) {
        console.log("🌐 Online: Syncing pending items before API fetch...");

        const dbItems = await getAllItems();
        const pendingItems = dbItems.filter(item => item.syncStatus === 'pending');

        const syncedIds = new Set(); // ✅ Track recently synced items

        for (const pending of pendingItems) {
          try {
            const { itemName, quantity, price, location } = pending;
            const res = await axios.post(
              'https://backend-nlxq.onrender.com/api/inventory',
              { itemName, quantity, price, location },
              { headers: { Authorization: `Bearer ${token}` } }
            );

            console.log(`✅ Synced pending item: ${itemName}`);

            if (pending._id !== res.data._id) {
              await deleteItem(pending._id); // 🔄 Remove temp item
            }

            await addItem({ ...res.data, syncStatus: 'synced' });
            syncedIds.add(res.data._id);

          } catch (err) {
            console.error(`❌ Failed to sync item: ${pending.itemName}`, err.response?.data || err);
          }
        }

        const response = await axios.get('https://backend-nlxq.onrender.com/api/inventory', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const apiItems = response.data;

        await clearInventoryStore();

        for (const item of apiItems) {
          if (!syncedIds.has(item._id)) {
            await addItem({ ...item, syncStatus: 'synced' });
          }
        }

        setInventory(apiItems);
        console.log("✅ Inventory updated from API and stored in IndexedDB.");
      } else {
        const dbItems = await getAllItems();
        setInventory(dbItems);
        console.log("📦 Offline: Loaded from IndexedDB.", dbItems);
      }
    };

    loadInventory();
  }, [token, dbReady]);

  // Handle form input
  const handleChange = (e) => {
    setNewItem({ ...newItem, [e.target.name]: e.target.value });
  };

  // Add item to local IndexedDB
  const handleAddItem = async (e) => {
    e.preventDefault();
    const added = await addItem({
      ...newItem,
      quantity: parseInt(newItem.quantity, 10),
      price: parseFloat(newItem.price)
    });
    console.log('✅ Item added to IndexedDB:', added);
    setInventory([...inventory, added]);
    setNewItem({ itemName: '', quantity: '', price: '', location: '' });
  };

  // Update local item
  const handleUpdate = async (item) => {
    const updated = await updateItem({ ...item, quantity: item.quantity + 1 });
    setInventory(inventory.map((inv) => (inv._id === updated._id ? updated : inv)));
  };

  // Delete local item
  const handleDelete = async (id) => {
    await deleteItem(id);
    setInventory(inventory.filter((inv) => inv._id !== id));
  };

  return (
    <div>
      <h2>Inventory</h2>
      {inventory.length === 0 ? (
        <p>No items in inventory. Add your first item below.</p>
      ) : (
        <ul>
          {inventory.map((item) => (
            <li key={item._id}>
              {item.itemName} - {item.quantity} @ ${item.price} ({item.location})
              <button onClick={() => handleUpdate(item)}>Update Qty</button>
              <button onClick={() => handleDelete(item._id)}>Delete</button>
            </li>
          ))}
        </ul>
      )}

      <h3>Add New Item</h3>
      <form onSubmit={handleAddItem}>
        <input name="itemName" placeholder="Item Name" value={newItem.itemName} onChange={handleChange} required />
        <input name="quantity" type="number" placeholder="Quantity" value={newItem.quantity} onChange={handleChange} required />
        <input name="price" type="number" step="0.01" placeholder="Price" value={newItem.price} onChange={handleChange} required />
        <input name="location" placeholder="Location" value={newItem.location} onChange={handleChange} required />
        <button type="submit">Add Item</button>
      </form>
    </div>
  );
}