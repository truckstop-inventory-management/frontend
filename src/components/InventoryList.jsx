// src/components/InventoryList.jsx

import React, { useEffect, useState, useRef } from "react";
import { getAllItems, addItem, updateItem, markItemDeleted, unmarkItemDeleted } from "../utils/db.js";
import SyncStatusPill from "../components/SyncStatusPill.jsx";
import useToast from "../hooks/useToast.js"; // added

const InventoryList = ({ dbReady, onMetricsChange }) => {
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState({
    itemName: "",
    quantity: 0,
    price: "",
    location: "C-Store",
  });

  const toast = useToast();                // added
  const longPressTimers = useRef({});      // added

  // helper for long-press delete trigger (600ms)
  const createLongPressHandlers = (id, onConfirm, threshold = 600) => {
    const start = () => {
      if (longPressTimers.current[id]) clearTimeout(longPressTimers.current[id]);
      longPressTimers.current[id] = setTimeout(() => {
        onConfirm();
        clearTimeout(longPressTimers.current[id]);
        delete longPressTimers.current[id];
      }, Math.max(0, threshold));
    };
    const stop = () => {
      if (longPressTimers.current[id]) {
        clearTimeout(longPressTimers.current[id]);
        delete longPressTimers.current[id];
      }
    };
    return {
      onMouseDown: start,
      onMouseUp: stop,
      onMouseLeave: stop,
      onTouchStart: (e) => { if (e.cancelable) e.preventDefault(); start(); },
      onTouchEnd: stop,
      onTouchCancel: stop,
    };
  };

  // Load items when dbReady changes
  useEffect(() => {
    if (dbReady) {
      getAllItems().then((data) => {
        setItems(data);

        // update metrics
        const counts = { "C-Store": 0, Restaurant: 0 };
        const totals = { "C-Store": 0, Restaurant: 0 };
        data.forEach((i) => {
          if (i.location && counts[i.location] !== undefined) {
            counts[i.location]++;
            totals[i.location] += Number(i.price) * Number(i.quantity);
          }
        });
        onMetricsChange({ counts, totals });
      });
    }
  }, [dbReady, onMetricsChange]);

  const handleAddItem = async () => {
    if (!newItem.itemName) return;
    const added = await addItem(newItem);
    setItems([...items, added]);
    setNewItem({ itemName: "", quantity: 0, price: "", location: "C-Store" });
  };

  const handleUpdateItem = async (id, field, value) => {
    const updatedItem = items.find((i) => i._id === id);
    if (!updatedItem) return;

    updatedItem[field] = value;

    await updateItem(updatedItem);
    setItems(items.map((i) => (i._id === id ? updatedItem : i)));
  };

  // delete with toast + undo (UI-only)
  const handleDeleteItem = async (id) => {
    const prev = items.find((i) => i._id === id);
    if (!prev) return;

    await markItemDeleted(id);
    const next = items.map((i) => (i._id === id ? { ...i, isDeleted: true } : i));
    setItems(next);

    // recompute metrics excluding deleted
    const visible = next.filter((i) => !i.isDeleted);
    const counts = { "C-Store": 0, Restaurant: 0 };
    const totals = { "C-Store": 0, Restaurant: 0 };
    visible.forEach((i) => {
      if (i.location && counts[i.location] !== undefined) {
        counts[i.location]++;
        totals[i.location] += Number(i.price) * Number(i.quantity);
      }
    });
    onMetricsChange({ counts, totals });

    // toast undo: flip the flag back and restore metrics
    toast.show({
      message: "Item deleted",
      duration: 5000,
      onUndo: async () => {
        const restored = await unmarkItemDeleted(id);
        const restoredState = items.map((i) => (i._id === id ? { ...restored, isDeleted: false } : i));
        setItems(restoredState);

        const visible2 = restoredState.filter((i) => !i.isDeleted);
        const counts2 = { "C-Store": 0, Restaurant: 0 };
        const totals2 = { "C-Store": 0, Restaurant: 0 };
        visible2.forEach((i) => {
          if (i.location && counts2[i.location] !== undefined) {
            counts2[i.location]++;
            totals2[i.location] += Number(i.price) * Number(i.quantity);
          }
        });
        onMetricsChange({ counts: counts2, totals: totals2 });
      },
    });
  };


  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">Inventory List</h2>

      {/* Add Item */}
      <div className="flex gap-2 mb-4">
        <input
          className="border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          placeholder="Item Name"
          value={newItem.itemName}
          onChange={(e) => setNewItem({ ...newItem, itemName: e.target.value })}
        />
        <input
          type="number"
          className="border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          placeholder="Qty"
          value={newItem.quantity}
          onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })}
        />
        <input
          type="number"
          step="0.01"
          className="border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          placeholder="Price"
          value={newItem.price}
          onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
        />
        <select
          className="border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          value={newItem.location}
          onChange={(e) => setNewItem({ ...newItem, location: e.target.value })}
        >
          <option value="C-Store">C-Store</option>
          <option value="Restaurant">Restaurant</option>
        </select>
        <button
          onClick={handleAddItem}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
        >
          Add
        </button>
      </div>

      {/* Items List */}
      <table className="w-full border border-gray-300 dark:border-gray-600">
        <thead>
        <tr className="bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
          <th className="border border-gray-300 dark:border-gray-600 p-2">Name</th>
          <th className="border border-gray-300 dark:border-gray-600 p-2">Qty</th>
          <th className="border border-gray-300 dark:border-gray-600 p-2">Price</th>
          <th className="border border-gray-300 dark:border-gray-600 p-2">Location</th>
          <th className="border border-gray-300 dark:border-gray-600 p-2">Status</th>
          <th className="border border-gray-300 dark:border-gray-600 p-2">Actions</th>
        </tr>
        </thead>
        <tbody>
        {items.filter(i => !i.isDeleted).map((i) => {
          const longPressHandlers = createLongPressHandlers(i._id, () => handleDeleteItem(i._id));
          return (
            <tr key={i._id} className="text-center">
              <td className="border border-gray-300 dark:border-gray-600 p-2">{i.itemName}</td>
              <td className="border border-gray-300 dark:border-gray-600 p-2">
                <input
                  type="number"
                  value={i.quantity}
                  onChange={(e) => handleUpdateItem(i._id, "quantity", Number(e.target.value))}
                  className="border border-gray-300 dark:border-gray-600 p-1 w-16 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </td>
              <td className="border border-gray-300 dark:border-gray-600 p-2">
                <input
                  type="number"
                  step="0.01"
                  value={i.price}
                  onChange={(e) => handleUpdateItem(i._id, "price", e.target.value)}
                  className="border border-gray-300 dark:border-gray-600 p-1 w-20 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </td>
              <td className="border border-gray-300 dark:border-gray-600 p-2">
                <select
                  value={i.location}
                  onChange={(e) => handleUpdateItem(i._id, "location", e.target.value)}
                  className="border border-gray-300 dark:border-gray-600 p-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="C-Store">C-Store</option>
                  <option value="Restaurant">Restaurant</option>
                </select>
              </td>
              <td className="border border-gray-300 dark:border-gray-600 p-2">
                <SyncStatusPill status={i.syncStatus} />
              </td>
              <td className="border border-gray-300 dark:border-gray-600 p-2">
                <button
                  {...longPressHandlers}
                  className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                  title="Press and hold to delete"
                >
                  Delete
                </button>
              </td>
            </tr>
          );
        })}
        </tbody>
      </table>
    </div>
  );
};

export default InventoryList;
