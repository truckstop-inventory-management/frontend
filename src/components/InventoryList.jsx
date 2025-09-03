// src/components/InventoryList.jsx

import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { getAllItems, addItem, updateItem, markItemDeleted, unmarkItemDeleted } from "../utils/db.js";
import SyncStatusPill from "../components/SyncStatusPill.jsx";
import useToast from "../hooks/useToast.js"; // added

const UI_PREFS_KEY = "tsinv:uiPrefs"; // ⬅️ persist UI choices

const InventoryList = ({ dbReady, onMetricsChange }) => {
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState({
    itemName: "",
    quantity: 0,
    price: "",
    location: "C-Store",
  });

  // --- sort/filter state (UI-only) ---
  const [sortBy, setSortBy] = useState("itemName"); // "itemName" | "quantity" | "price"
  const [sortDir, setSortDir] = useState("asc");    // "asc" | "desc"
  const [inStockOnly, setInStockOnly] = useState(false);

  // --- low-stock state (+ persistence) ---
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [lowStockThreshold, setLowStockThreshold] = useState(5);

  // --- edit modal state ---
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null); // {_id, itemName, quantity, price, location}

  const toast = useToast();
  const longPressTimers = useRef({});

  // dev-only toggle (load the app as http://.../?dev=1)
  const isDev = typeof window !== "undefined" && !!(window.location && window.location.search.includes("dev=1"));

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

  // load persisted UI prefs on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(UI_PREFS_KEY);
      if (!raw) return;
      const prefs = JSON.parse(raw);
      if (typeof prefs.showLowStockOnly === "boolean") setShowLowStockOnly(prefs.showLowStockOnly);
      if (Number.isFinite(prefs.lowStockThreshold)) setLowStockThreshold(prefs.lowStockThreshold);
      if (typeof prefs.inStockOnly === "boolean") setInStockOnly(prefs.inStockOnly);
      if (typeof prefs.sortBy === "string") setSortBy(prefs.sortBy);
      if (typeof prefs.sortDir === "string") setSortDir(prefs.sortDir);
    } catch (err) {
      console.warn("UI prefs parse error", err);
    }
  }, []);

  // persist UI prefs when relevant values change
  useEffect(() => {
    try {
      const raw = localStorage.getItem(UI_PREFS_KEY);
      const prev = raw ? JSON.parse(raw) : {};
      const merged = {
        ...prev,
        showLowStockOnly,
        lowStockThreshold: Number.isFinite(lowStockThreshold) ? lowStockThreshold : 5,
        inStockOnly,
        sortBy,
        sortDir,
      };
      localStorage.setItem(UI_PREFS_KEY, JSON.stringify(merged));
    } catch (err) {
      console.warn("UI prefs save error", err);
    }
  }, [showLowStockOnly, lowStockThreshold, inStockOnly, sortBy, sortDir]);

  const handleAddItem = async () => {
    if (!newItem.itemName) return;
    const added = await addItem(newItem);
    setItems((prev) => [...prev, added]);
    setNewItem({ itemName: "", quantity: 0, price: "", location: "C-Store" });
  };

  // ✅ Stable update handler (no 'items' dependency)
  const handleUpdateItem = useCallback(async (id, field, value) => {
    let nextItem = null;
    setItems((prev) => {
      const updated = prev.map((i) => {
        if (i._id !== id) return i;
        nextItem = { ...i, [field]: value };
        return nextItem;
      });
      return updated;
    });
    if (nextItem) {
      await updateItem(nextItem);
    }
  }, []);

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

    // toast undo
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

  // derive visible items using current filters and sorting
  const visibleItems = (() => {
    let list = items.filter((i) => !i.isDeleted);

    if (inStockOnly) {
      list = list.filter((i) => Number(i?.quantity) > 0);
    }

    if (showLowStockOnly) {
      const th = Number.isFinite(lowStockThreshold) ? lowStockThreshold : 5;
      list = list.filter((i) => Number(i?.quantity) <= th);
    }

    const dir = sortDir === "desc" ? -1 : 1;
    list = [...list].sort((a, b) => {
      const av = sortBy === "itemName" ? (a.itemName || "") : Number(a[sortBy] ?? 0);
      const bv = sortBy === "itemName" ? (b.itemName || "") : Number(b[sortBy] ?? 0);

      if (sortBy === "itemName") {
        return av.localeCompare(bv) * dir;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });

    return list;
  })();

  // totals derived from visibleItems (so filters affect totals display)
  const { totalsByGroup, totalOverall } = useMemo(() => {
    const acc = { "C-Store": 0, Restaurant: 0 };
    for (const it of visibleItems) {
      const loc = acc[it.location] !== undefined ? it.location : null;
      const price = Number(it?.price) || 0;
      const qty = Number(it?.quantity) || 0;
      if (loc) acc[loc] += price * qty;
    }
    const overall = (acc["C-Store"] || 0) + (acc["Restaurant"] || 0);
    return { totalsByGroup: acc, totalOverall: overall };
  }, [visibleItems]);

  // dev-only smoke test
  const runLowStockSmoke = () => {
    const th = 5;
    const src = items.filter((i) => !i.isDeleted);
    const filtered = src.filter((i) => Number(i?.quantity) <= th);
    const ok = filtered.every((i) => Number(i?.quantity) <= th);
    const sample = filtered.slice(0, 5).map((i) => ({ name: i.itemName, q: i.quantity }));

    console.group("[SmokeTest] Low-stock filter");
    console.log("Threshold:", th);
    console.log("Total items:", src.length);
    console.log("Filtered count (<= th):", filtered.length);
    console.log("Sample:", sample);
    console.log("PASS:", ok);
    console.groupEnd();

    toast.show({
      message: ok ? "Low-stock smoke test: PASS" : "Low-stock smoke test: FAIL",
      duration: 3500,
    });
  };

  // --- edit modal handlers ---
  const openEditModal = (item) => {
    setEditingItem({
      _id: item._id,
      itemName: item.itemName || "",
      quantity: Number(item.quantity) || 0,
      price: item.price ?? "",
      location: item.location || "C-Store",
    });
    setIsEditOpen(true);
  };

  const closeEditModal = () => {
    setIsEditOpen(false);
    setEditingItem(null);
  };

  const onEditField = (field, value) => {
    setEditingItem((prev) => ({ ...prev, [field]: value }));
  };

  // Stable save handler; now safe to include in effect deps
  const saveEditModal = useCallback(async () => {
    if (!editingItem?._id) return;
    await handleUpdateItem(editingItem._id, "quantity", Number(editingItem.quantity));
    await handleUpdateItem(editingItem._id, "price", editingItem.price);
    await handleUpdateItem(editingItem._id, "location", editingItem.location);
    closeEditModal();
  }, [editingItem, handleUpdateItem]);

  // keyboard accessibility for modal
  useEffect(() => {
    if (!isEditOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeEditModal();
      if (e.key === "Enter") saveEditModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isEditOpen, saveEditModal]);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">Inventory List</h2>

      {/* Add Item */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <input
          className="border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 min-w-[160px]"
          placeholder="Item Name"
          value={newItem.itemName}
          onChange={(e) => setNewItem({ ...newItem, itemName: e.target.value })}
        />
        <input
          type="number"
          className="border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-24"
          placeholder="Qty"
          value={newItem.quantity}
          onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })}
        />
        <input
          type="number"
          step="0.01"
          className="border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-28"
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

      {/* Sort & Filter Controls */}
      <div className="flex flex-wrap items-center gap-3 gap-y-2 mb-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700 dark:text-gray-300">Sort</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="itemName">Name</option>
            <option value="quantity">Quantity</option>
            <option value="price">Price</option>
          </select>

          <select
            value={sortDir}
            onChange={(e) => setSortDir(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => setInStockOnly(e.target.checked)}
            className="h-5 w-5"
          />
          In-stock only
        </label>

        {/* Low-stock controls */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={showLowStockOnly}
              onChange={(e) => setShowLowStockOnly(e.target.checked)}
              className="h-5 w-5"
            />
            Low stock only
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            Threshold:
            <input
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={lowStockThreshold}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                setLowStockThreshold(Number.isFinite(v) && v >= 0 ? v : 0);
              }}
              className="border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-24"
              aria-label="Low stock threshold"
              title="Show items with quantity ≤ this number"
            />
          </label>
        </div>
      </div>

      {/* Totals Summary (respects current filters) */}
      <div className="mb-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="rounded border border-gray-300 dark:border-gray-600 p-2 bg-gray-50 dark:bg-gray-800/40">
          <div className="text-xs text-gray-600 dark:text-gray-400">C-Store Total</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            ${totalsByGroup["C-Store"].toFixed(2)}
          </div>
        </div>
        <div className="rounded border border-gray-300 dark:border-gray-600 p-2 bg-gray-50 dark:bg-gray-800/40">
          <div className="text-xs text-gray-600 dark:text-gray-400">Restaurant Total</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            ${totalsByGroup["Restaurant"].toFixed(2)}
          </div>
        </div>
        <div className="rounded border border-gray-300 dark:border-gray-600 p-2 bg-gray-100 dark:bg-gray-700/50">
          <div className="text-xs text-gray-700 dark:text-gray-300">Overall Total</div>
          <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
            ${totalOverall.toFixed(2)}
          </div>
        </div>
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
        {visibleItems.map((i) => {
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
                  onChange={(e) => handleUpdateItem(i._id, "price", e.target.value))}
                  className="border border-gray-300 dark:border-gray-600 p-1 w-20 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </td>
              <td className="border border-gray-300 dark:border-gray-600 p-2">
                <select
                  value={i.location}
                  onChange={(e) => handleUpdateItem(i._id, "location", e.target.value))}
                  className="border border-gray-300 dark:border-gray-600 p-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="C-Store">C-Store</option>
                  <option value="Restaurant">Restaurant</option>
                </select>
              </td>
              <td className="border border-gray-300 dark:border-gray-600 p-2">
                <SyncStatusPill status={i.syncStatus} />
              </td>
              <td className="border border-gray-300 dark:border-gray-600 p-2 space-x-2">
                <button
                  onClick={() => openEditModal(i)}
                  className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                  title="Edit item"
                >
                  Edit
                </button>
                <button
                  {...longPressHandlers}
                  className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
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

      {/* Dev-only: quick smoke test helper */}
      {isDev && (
        <div className="mt-3 p-2 border border-dashed border-gray-400 rounded text-sm text-gray-700 dark:text-gray-300">
          <button
            onClick={runLowStockSmoke}
            className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
          >
            Run Low-Stock Smoke Test
          </button>
          <span className="ml-2 opacity-80">
            (opens console; uses threshold=5 and current items)
          </span>
        </div>
      )}

      {/* Edit Item Modal */}
      {isEditOpen && editingItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Edit Item"
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeEditModal}
          />
          {/* modal card */}
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-xl border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
              Edit Item
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Name</label>
                <input
                  className="w-full border border-gray-300 dark:border-gray-600 rounded p-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  value={editingItem.itemName}
                  onChange={(e) => onEditField("itemName", e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Quantity</label>
                  <input
                    type="number"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded p-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    value={editingItem.quantity}
                    onChange={(e) => onEditField("quantity", Number(e.target.value))}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Price</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded p-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    value={editingItem.price}
                    onChange={(e) => onEditField("price", e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Location</label>
                <select
                  className="w-full border border-gray-300 dark:border-gray-600 rounded p-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  value={editingItem.location}
                  onChange={(e) => onEditField("location", e.target.value)}
                >
                  <option value="C-Store">C-Store</option>
                  <option value="Restaurant">Restaurant</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={closeEditModal}
                className="px-4 py-2 rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={saveEditModal}
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryList;
