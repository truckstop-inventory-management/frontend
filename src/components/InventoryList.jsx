// src/components/InventoryList.jsx

import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { getAllItems, addItem, updateItem, markItemDeleted, unmarkItemDeleted } from "../utils/db.js";
import SyncStatusPill from "../components/SyncStatusPill.jsx";
import useToast from "../hooks/useToast.js";

const UI_PREFS_KEY = "tsinv:uiPrefs"; // persist UI choices

const InventoryList = ({ dbReady, onMetricsChange }) => {
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState({
    itemName: "",
    quantity: 0,
    price: "",
    location: "C-Store",
  });

  // --- sort/filter state ---
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

  // modal focus management
  const modalRef = useRef(null);
  const firstFieldRef = useRef(null);
  const openTriggerRef = useRef(null); // stores the button that opened the modal

  // dev-only toggle (load app with ?dev=1)
  const isDev =
    typeof window !== "undefined" &&
    !!(window.location && window.location.search.includes("dev=1"));

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
      onTouchStart: (e) => {
        if (e.cancelable) e.preventDefault();
        start();
      },
      onTouchEnd: stop,
      onTouchCancel: stop,
    };
  };

  // Load items when dbReady changes
  useEffect(() => {
    if (!dbReady) return;
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
  }, [dbReady, onMetricsChange]);

  // load persisted UI prefs on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(UI_PREFS_KEY);
      if (!raw) return;
      const prefs = JSON.parse(raw);
      if (typeof prefs.showLowStockOnly === "boolean")
        setShowLowStockOnly(prefs.showLowStockOnly);
      if (Number.isFinite(prefs.lowStockThreshold))
        setLowStockThreshold(prefs.lowStockThreshold);
      if (typeof prefs.inStockOnly === "boolean")
        setInStockOnly(prefs.inStockOnly);
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
        lowStockThreshold: Number.isFinite(lowStockThreshold)
          ? lowStockThreshold
          : 5,
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

  // Stable update handler (no 'items' dependency)
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
    const next = items.map((i) =>
      i._id === id ? { ...i, isDeleted: true } : i
    );
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
        const restoredState = items.map((i) =>
          i._id === id ? { ...restored, isDeleted: false } : i
        );
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
      const av =
        sortBy === "itemName" ? a.itemName || "" : Number(a[sortBy] ?? 0);
      const bv =
        sortBy === "itemName" ? b.itemName || "" : Number(b[sortBy] ?? 0);

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
    const sample = filtered
      .slice(0, 5)
      .map((i) => ({ name: i.itemName, q: i.quantity }));

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
  const openEditModal = (item, evt) => {
    // remember the trigger for focus return
    if (evt && evt.currentTarget) {
      openTriggerRef.current = evt.currentTarget;
    }
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
    // return focus to the trigger after close paints
    setTimeout(() => {
      if (
        openTriggerRef.current &&
        typeof openTriggerRef.current.focus === "function"
      ) {
        openTriggerRef.current.focus();
      }
    }, 0);
  };

  const onEditField = (field, value) => {
    setEditingItem((prev) => ({ ...prev, [field]: value }));
  };

  // Stable save handler; safe to include in deps
  const saveEditModal = useCallback(async () => {
    if (!editingItem?._id) return;
    await handleUpdateItem(
      editingItem._id,
      "quantity",
      Number(editingItem.quantity)
    );
    await handleUpdateItem(editingItem._id, "price", editingItem.price);
    await handleUpdateItem(editingItem._id, "location", editingItem.location);
    closeEditModal();
  }, [editingItem, handleUpdateItem]);

  // focus trap + initial focus inside modal
  useEffect(() => {
    if (!isEditOpen) return;

    // Focus first field
    setTimeout(() => {
      if (firstFieldRef.current) firstFieldRef.current.focus();
    }, 0);

    const node = modalRef.current;
    if (!node) return;

    const selector = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");

    const getFocusable = () => Array.from(node.querySelectorAll(selector));

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeEditModal();
        return;
      }
      if (e.key !== "Tab") return;

      const focusables = getFocusable();
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement;

      if (e.shiftKey) {
        if (current === first || !node.contains(current)) {
          last.focus();
          e.preventDefault();
        }
      } else {
        if (current === last) {
          first.focus();
          e.preventDefault();
        }
      }
    };

    node.addEventListener("keydown", onKeyDown);
    return () => node.removeEventListener("keydown", onKeyDown);
  }, [isEditOpen]);

  // enter-to-save (inputs/selects only)
  useEffect(() => {
    if (!isEditOpen) return;
    const onKey = (e) => {
      if (e.key === "Enter") {
        const tag = (document.activeElement?.tagName || "").toLowerCase();
        if (tag === "input" || tag === "select" || tag === "textarea") {
          e.preventDefault();
          saveEditModal();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isEditOpen, saveEditModal]);

  return (
    <section aria-labelledby="inv-heading" className="p-4">
      <h2 id="inv-heading" className="text-xl font-bold mb-4 text-[var(--color-text)]">
        Inventory List
      </h2>

      {/* Add Item */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <input
          className="focus-ring border border-[var(--color-border)] p-2 rounded bg-[var(--color-surface)] text-[var(--color-text)] min-w-[160px]"
          placeholder="Item Name"
          aria-label="New item name"
          value={newItem.itemName}
          onChange={(e) =>
            setNewItem({ ...newItem, itemName: e.target.value })
          }
        />
        <input
          type="number"
          className="focus-ring border border-[var(--color-border)] p-2 rounded bg-[var(--color-surface)] text-[var(--color-text)] w-24"
          placeholder="Qty"
          aria-label="New item quantity"
          value={newItem.quantity}
          onChange={(e) =>
            setNewItem({ ...newItem, quantity: Number(e.target.value) })
          }
        />
        <input
          type="number"
          step="0.01"
          className="focus-ring border border-[var(--color-border)] p-2 rounded bg-[var(--color-surface)] text-[var(--color-text)] w-28"
          placeholder="Price"
          aria-label="New item price"
          value={newItem.price}
          onChange={(e) =>
            setNewItem({ ...newItem, price: e.target.value })
          }
        />
        <select
          className="focus-ring border border-[var(--color-border)] p-2 rounded bg-[var(--color-surface)] text-[var(--color-text)]"
          aria-label="New item location"
          value={newItem.location}
          onChange={(e) =>
            setNewItem({ ...newItem, location: e.target.value })
          }
        >
          <option value="C-Store">C-Store</option>
          <option value="Restaurant">Restaurant</option>
        </select>
        <button
          onClick={handleAddItem}
          aria-label="Add item"
          className="focus-ring bg-[var(--color-success)] text-white px-4 py-2 rounded hover:bg-[var(--color-success)]"
        >
          Add
        </button>
      </div>

      {/* Sort & Filter Controls */}
      <div className="flex flex-wrap items-center gap-3 gap-y-2 mb-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-[var(--color-text)]">Sort</label>
          <select
            value={sortBy}
            aria-label="Sort by"
            onChange={(e) => setSortBy(e.target.value)}
            className="focus-ring border border-[var(--color-border)] p-2 rounded bg-[var(--color-surface)] text-[var(--color-text)]"
          >
            <option value="itemName">Name</option>
            <option value="quantity">Quantity</option>
            <option value="price">Price</option>
          </select>

          <select
            value={sortDir}
            aria-label="Sort direction"
            onChange={(e) => setSortDir(e.target.value)}
            className="focus-ring border border-[var(--color-border)] p-2 rounded bg-[var(--color-surface)] text-[var(--color-text)]"
          >
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => setInStockOnly(e.target.checked)}
            className="focus-ring h-5 w-5"
            aria-label="In-stock only"
          />
          In-stock only
        </label>

        {/* Low-stock controls */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
            <input
              type="checkbox"
              checked={showLowStockOnly}
              onChange={(e) => setShowLowStockOnly(e.target.checked)}
              className="focus-ring h-5 w-5"
              aria-label="Low stock only"
            />
            Low stock only
          </label>

          <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
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
              className="focus-ring border border-[var(--color-border)] p-2 rounded bg-[var(--color-surface)] text-[var(--color-text)] w-24"
              aria-label="Low stock threshold"
              title="Show items with quantity ≤ this number"
            />
          </label>
        </div>
      </div>

      {/* Totals Summary (respects current filters) */}
      <div className="mb-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="rounded border border-[var(--color-border)] p-2 bg-[var(--color-surface-2)]">
          <div className="text-xs text-[var(--color-muted)]">C-Store Total</div>
          <div className="text-lg font-semibold text-[var(--color-text)]">
            ${totalsByGroup["C-Store"].toFixed(2)}
          </div>
        </div>
        <div className="rounded border border-[var(--color-border)] p-2 bg-[var(--color-surface-2)]">
          <div className="text-xs text-[var(--color-muted)]">Restaurant Total</div>
          <div className="text-lg font-semibold text-[var(--color-text)]">
            ${totalsByGroup["Restaurant"].toFixed(2)}
          </div>
        </div>
        <div className="rounded border border-[var(--color-border)] p-2 bg-[var(--color-surface-2)]">
          <div className="text-xs text-[var(--color-text)]/80">Overall Total</div>
          <div className="text-lg font-bold text-[var(--color-text)]">
            ${totalOverall.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Items List (scrolls horizontally on small screens) */}
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full border border-[var(--color-border)]">
          <thead>
          <tr className="bg-[var(--color-surface-2)] text-[var(--color-text)]">
            <th scope="col" className="border border-[var(--color-border)] p-2">Name</th>
            <th scope="col" className="border border-[var(--color-border)] p-2">Qty</th>
            <th scope="col" className="border border-[var(--color-border)] p-2">Price</th>
            <th scope="col" className="border border-[var(--color-border)] p-2">Location</th>
            <th scope="col" className="border border-[var(--color-border)] p-2">Status</th>
            <th scope="col" className="border border-[var(--color-border)] p-2">Actions</th>
          </tr>
          </thead>
          <tbody className="text-[var(--color-text)]">
          {visibleItems.map((i) => {
            const longPressHandlers = createLongPressHandlers(i._id, () =>
              handleDeleteItem(i._id)
            );
            return (
              <tr key={i._id} className="text-center">
                <td className="border border-[var(--color-border)] p-2">
                  {i.itemName}
                </td>
                <td className="border border-[var(--color-border)] p-2">
                  <input
                    type="number"
                    value={i.quantity}
                    aria-label={`Quantity for ${i.itemName}`}
                    onChange={(e) =>
                      handleUpdateItem(i._id, "quantity", Number(e.target.value))
                    }
                    className="focus-ring border border-[var(--color-border)] p-1 w-16 bg-[var(--color-surface)] text-[var(--color-text)]"
                  />
                </td>
                <td className="border border-[var(--color-border)] p-2">
                  <input
                    type="number"
                    step="0.01"
                    value={i.price}
                    aria-label={`Price for ${i.itemName}`}
                    onChange={(e) =>
                      handleUpdateItem(i._id, "price", e.target.value)
                    }
                    className="focus-ring border border-[var(--color-border)] p-1 w-20 bg-[var(--color-surface)] text-[var(--color-text)]"
                  />
                </td>
                <td className="border border-[var(--color-border)] p-2">
                  <select
                    value={i.location}
                    aria-label={`Location for ${i.itemName}`}
                    onChange={(e) =>
                      handleUpdateItem(i._id, "location", e.target.value)
                    }
                    className="focus-ring border border-[var(--color-border)] p-1 bg-[var(--color-surface)] text-[var(--color-text)]"
                  >
                    <option value="C-Store">C-Store</option>
                    <option value="Restaurant">Restaurant</option>
                  </select>
                </td>
                <td className="border border-[var(--color-border)] p-2">
                  <SyncStatusPill status={i.syncStatus} ariaLabel={`${i.itemName} is ${String(i.syncStatus || 'unknown')}`} />
                </td>
                <td className="border border-[var(--color-border)] p-2 space-x-2">
                  <button
                    onClick={(e) => openEditModal(i, e)}
                    className="focus-ring bg-[var(--color-primary)] text-white px-3 py-1 rounded hover:bg-[var(--color-primary)]"
                    title="Edit item"
                    aria-label={`Edit ${i.itemName}`}
                  >
                    Edit
                  </button>
                  <button
                    {...longPressHandlers}
                    className="focus-ring bg-[var(--color-danger)] text-white px-3 py-1 rounded hover:bg-[var(--color-danger)]"
                    title="Press and hold to delete"
                    aria-label={`Delete ${i.itemName} (press and hold)`}
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

      {/* Dev-only: quick smoke test helper */}
      {isDev && (
        <div className="mt-3 p-2 border border-dashed border-[var(--color-border)] rounded text-sm text-[var(--color-text)]">
          <button
            onClick={runLowStockSmoke}
            className="focus-ring bg-[var(--color-primary)] text-white px-3 py-1 rounded hover:bg-[var(--color-primary)]"
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
          <div
            ref={modalRef}
            className="relative z-10 w-full max-w-md rounded-2xl bg-[var(--color-surface)] shadow-xl border border-[var(--color-border)] p-4
                       transition transform duration-150 ease-out motion-reduce:transition-none motion-reduce:transform-none"
          >
            <h3 className="text-lg font-semibold mb-3 text-[var(--color-text)]">
              Edit Item
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-[var(--color-text)]/80 mb-1">
                  Name
                </label>
                <input
                  ref={firstFieldRef}
                  className="focus-ring w-full border border-[var(--color-border)] rounded p-2 bg-[var(--color-surface)] text-[var(--color-text)]"
                  value={editingItem.itemName}
                  onChange={(e) => onEditField("itemName", e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-sm text-[var(--color-text)]/80 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    className="focus-ring w-full border border-[var(--color-border)] rounded p-2 bg-[var(--color-surface)] text-[var(--color-text)]"
                    value={editingItem.quantity}
                    onChange={(e) =>
                      onEditField("quantity", Number(e.target.value))
                    }
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm text-[var(--color-text)]/80 mb-1">
                    Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="focus-ring w-full border border-[var(--color-border)] rounded p-2 bg-[var(--color-surface)] text-[var(--color-text)]"
                    value={editingItem.price}
                    onChange={(e) => onEditField("price", e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-[var(--color-text)]/80 mb-1">
                  Location
                </label>
                <select
                  className="focus-ring w-full border border-[var(--color-border)] rounded p-2 bg-[var(--color-surface)] text-[var(--color-text)]"
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
                className="focus-ring px-4 py-2 rounded border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
              >
                Cancel
              </button>
              <button
                onClick={saveEditModal}
                className="focus-ring px-4 py-2 rounded bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default InventoryList;
