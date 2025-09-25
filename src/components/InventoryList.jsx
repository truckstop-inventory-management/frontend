// src/components/InventoryList.jsx

import React, { useEffect, useState, useRef, useCallback } from "react";
import { getAllItems, updateItem, markItemDeleted, unmarkItemDeleted } from "../utils/db.js";
import useToast from "../hooks/useToast.js";
import useUIPrefs from "../hooks/useUIPrefs.js";
import useSyncSpinner from "../hooks/useSyncSpinner.js";
import useEditModalKeyboard from "../hooks/useEditModalKeyboard.js";
import useVisibleItems from "../hooks/useVisibleItems.js";
import useTotals from "../hooks/useTotals.js";
import useAddItem from "../hooks/useAddItem.js";
import InlineSpinner from "./inventory/InlineSpinner.jsx";
import AddItemForm from "./inventory/AddItemForm.jsx";
import SortFilterBar from "./inventory/SortFilterBar.jsx";
import TotalsSummary from "./inventory/TotalsSummary.jsx";
import ItemsTable from "./inventory/ItemsTable.jsx";
import EditItemModal from "./inventory/EditItemModal.jsx";
import { createLongPressHandlers } from "../utils/createLongPressHandlers.js";
import { runLowStockSmoke } from "../utils/runLowStockSmoke.js";
import useInstallPrompt from "../hooks/useInstallPrompt.js";
import OfflineBanner from "./OfflineBanner.jsx"; // ✅ mount the banner

const InventoryList = ({ dbReady, onMetricsChange }) => {
  const [items, setItems] = useState([]);

  const { newItem, setNewItem, addNewItem } = useAddItem();
  const { canInstall, promptInstall } = useInstallPrompt();

  const {
    sortBy, setSortBy,
    sortDir, setSortDir,
    inStockOnly, setInStockOnly,
    showLowStockOnly, setShowLowStockOnly,
    lowStockThreshold, setLowStockThreshold,
  } = useUIPrefs();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const toast = useToast();
  const longPressTimers = useRef({});

  const modalRef = useRef(null);
  const firstFieldRef = useRef(null);
  const openTriggerRef = useRef(null);

  const isDev =
    typeof window !== "undefined" &&
    !!(window.location && window.location.search.includes("dev=1"));

  const isSyncing = useSyncSpinner();

  // 🛠 TEMP iOS FIX — clear persisted UI prefs on first native run to avoid hidden filters
  useEffect(() => {
    try {
      const key = "tsinv:uiPrefs";
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
        console.log("[DEBUG/iOS] Cleared", key, "to avoid hidden filters on first native run.");
      } else {
        console.log("[DEBUG/iOS] No uiPrefs found; nothing to clear.");
      }
    } catch (e) {
      console.warn("[DEBUG/iOS] Could not access localStorage:", e);
    }
  }, []);

  // Load current items from IDB once DB is ready
  useEffect(() => {
    if (!dbReady) return;
    getAllItems().then((data) => {
      setItems(data);

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

  // When syncing finishes, refresh items
  const wasSyncingRef = useRef(false);
  useEffect(() => {
    if (wasSyncingRef.current && !isSyncing) {
      setTimeout(() => {
        getAllItems().then((data) => setItems(data));
      }, 50);
    }
    wasSyncingRef.current = isSyncing;
  }, [isSyncing]);

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

  const handleAddItem = async (payload) => {
    const added = await addNewItem(payload);
    if (added) setItems((prev) => [...prev, added]);
  };

  const handleDeleteItem = async (id) => {
    const prev = items.find((i) => i._id === id);
    if (!prev) return;

    await markItemDeleted(id);
    const next = items.map((i) =>
      i._id === id ? { ...i, isDeleted: true } : i
    );
    setItems(next);

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

  const visibleItems = useVisibleItems(items, {
    inStockOnly,
    showLowStockOnly,
    lowStockThreshold,
    sortBy,
    sortDir,
  });

  const { totalsByGroup, totalOverall } = useTotals(visibleItems);

  console.log("[DEBUG/iOS] counts", {
    rawItems: Array.isArray(items) ? items.length : "(n/a)",
    visibleItems: Array.isArray(visibleItems) ? visibleItems.length : "(n/a)",
  });

  const handleRunLowStockSmoke = () => {
    runLowStockSmoke(items, toast, { threshold: 5 });
  };

  const openEditModal = (item, evt) => {
    console.log("[Modal] openEditModal fired with:", item);
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

  const saveEditModal = useCallback(async () => {
    if (!editingItem?._id) return;
    await handleUpdateItem(editingItem._id, "quantity", Number(editingItem.quantity));
    await handleUpdateItem(editingItem._id, "price", editingItem.price);
    await handleUpdateItem(editingItem._id, "location", editingItem.location);
    closeEditModal();
  }, [editingItem, handleUpdateItem]);

  useEditModalKeyboard({
    isOpen: isEditOpen,
    modalRef,
    firstFieldRef,
    onClose: closeEditModal,
    onSave: saveEditModal,
  });

  return (
    <section aria-labelledby="inv-heading" className="p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 id="inv-heading" className="text-xl font-bold text-[var(--color-text)]">
          Inventory List
        </h2>
        {canInstall && (
          <button
            onClick={promptInstall}
            className="px-3 py-1 rounded bg-[var(--color-primary)] text-white"
          >
            Install App
          </button>
        )}
        {isSyncing ? <InlineSpinner label="Syncing…" /> : null}
      </div>

      <OfflineBanner /> {/* ✅ now rendered */}

      {/* 🛠 TEMP DEBUG PANEL */}
      <div style={{ padding: 8, fontSize: 12, color: "#90a4ae" }}>
        <div><b>Debug</b></div>
        <div>Raw items: {Array.isArray(items) ? items.length : 0}</div>
        <div>Visible items: {Array.isArray(visibleItems) ? visibleItems.length : 0}</div>
      </div>

      <AddItemForm
        newItem={newItem}
        setNewItem={setNewItem}
        onAdd={handleAddItem}
        disabled={isSyncing}
      />

      <SortFilterBar
        sortBy={sortBy} setSortBy={setSortBy}
        sortDir={sortDir} setSortDir={setSortDir}
        inStockOnly={inStockOnly} setInStockOnly={setInStockOnly}
        showLowStockOnly={showLowStockOnly} setShowLowStockOnly={setShowLowStockOnly}
        lowStockThreshold={lowStockThreshold} setLowStockThreshold={setLowStockThreshold}
      />

      <TotalsSummary totalsByGroup={totalsByGroup} totalOverall={totalOverall} />

      <ItemsTable
        items={visibleItems}
        isSyncing={isSyncing}
        onUpdateItem={handleUpdateItem}
        onOpenEditModal={openEditModal}
        createLongPressHandlers={(id, onConfirm) =>
          createLongPressHandlers(onConfirm, {
            id,
            threshold: 600,
            timersRef: longPressTimers,
          })
        }
        onDeleteItem={handleDeleteItem}
      />

      {isDev && (
        <div className="mt-3 p-2 border border-dashed border-[var(--color-border)] rounded text-sm text-[var(--color-text)]">
          <button
            onClick={handleRunLowStockSmoke}
            className="px-3 py-1 rounded bg-[var(--color-primary)] text-white"
            disabled={isSyncing}
          >
            Run Low-Stock Smoke Test
          </button>
          <span className="ml-2 opacity-80">(opens console; threshold=5)</span>
        </div>
      )}

      <EditItemModal
        isOpen={isEditOpen}
        editingItem={editingItem}
        isSyncing={isSyncing}
        onEditField={onEditField}
        onSave={saveEditModal}
        onClose={closeEditModal}
        modalRef={modalRef}
        firstFieldRef={firstFieldRef}
      />
    </section>
  );
};

export default InventoryList;
