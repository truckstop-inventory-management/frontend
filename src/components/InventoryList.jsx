// src/components/InventoryList.jsx
import React, { useEffect, useState, useMemo } from "react";
import {
  initDB,
  getActiveItems,
  addItem,
  updateItem,
  markItemDeleted,
} from "../utils/db";
import { runFullSync } from "../utils/sync";
import SyncStatusPill from "./SyncStatusPill.jsx";
import { normalizeLocation, LOCATION } from "../utils/location";

export default function InventoryList({ token, dbReady, locationFilter, onCountsChange }) {
  const [inventory, setInventory] = useState([]);
  const [newItem, setNewItem] = useState({
    itemName: "",
    quantity: "",
    price: "",
    location: "",
  });

  // Editing state
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({
    itemName: "",
    quantity: 0,
    price: 0,
    location: "",
  });

  useEffect(() => {
    const prepareDB = async () => {
      await initDB();
      console.log("✅ IndexedDB is ready for use in InventoryList");
    };
    prepareDB();
  }, []);

  const refreshLocalActive = async () => {
    const list = await getActiveItems();
    setInventory(list);
  };

  // Sync (when reachable) then refresh local view
  useEffect(() => {
    if (!dbReady) return;

    const doSync = async () => {
      try {
        await runFullSync(token);
      } catch (e) {
        console.warn("Sync error (ignored in UI):", e);
      } finally {
        await refreshLocalActive();
      }
    };

    if (navigator.onLine) {
      doSync();
    } else {
      refreshLocalActive();
    }

    const onOnline = () => doSync();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [token, dbReady]);

  // Add form handlers
  const handleChange = (e) => {
    setNewItem({ ...newItem, [e.target.name]: e.target.value });
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    const qty = Number(newItem.quantity);
    const price = Number(newItem.price);
    const added = await addItem({
      ...newItem,
      quantity: Number.isFinite(qty) ? qty : 0,
      price: Number.isFinite(price) ? price : 0,
      isDeleted: false,
    });
    console.log("✅ Item added to IndexedDB:", added);
    await refreshLocalActive();

    if (navigator.onLine) {
      try {
        await runFullSync(token);
      } finally {
        await refreshLocalActive();
      }
    }

    setNewItem({ itemName: "", quantity: "", price: "", location: "" });
  };

  // Delete → tombstone → sync
  const handleDelete = async (id) => {
    await markItemDeleted(id);
    await refreshLocalActive();
    if (navigator.onLine) {
      try {
        await runFullSync(token);
      } finally {
        await refreshLocalActive();
      }
    }
  };

  // ===== Edit mode =====
  function startEdit(item) {
    setEditingId(item._id);
    setEditDraft({
      itemName: item.itemName ?? "",
      quantity: Number(item.quantity ?? 0),
      price: Number(item.price ?? 0),
      location: item.location ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft({ itemName: "", quantity: 0, price: 0, location: "" });
  }

  function onEditChange(e) {
    const { name, value } = e.target;
    setEditDraft((d) => ({
      ...d,
      [name]:
        name === "quantity" ? Number(value)
        : name === "price" ? Number(value)
        : value,
    }));
  }

  const currentEditingItem = useMemo(
    () => inventory.find((x) => x._id === editingId) || null,
    [inventory, editingId]
  );

  const draftIsValid = useMemo(() => {
    if (!currentEditingItem) return false;
    if (!String(editDraft.itemName || "").trim()) return false;
    if (!Number.isFinite(Number(editDraft.quantity))) return false;
    if (!Number.isFinite(Number(editDraft.price))) return false;
    if (Number(editDraft.quantity) < 0) return false;
    if (Number(editDraft.price) < 0) return false;
    return true;
  }, [currentEditingItem, editDraft]);

  const draftIsDirty = useMemo(() => {
    if (!currentEditingItem) return false;
    return (
      String(currentEditingItem.itemName ?? "") !== String(editDraft.itemName ?? "") ||
      Number(currentEditingItem.quantity ?? 0) !== Number(editDraft.quantity ?? 0) ||
      Number(currentEditingItem.price ?? 0) !== Number(editDraft.price ?? 0) ||
      String(currentEditingItem.location ?? "") !== String(editDraft.location ?? "")
    );
  }, [currentEditingItem, editDraft]);

  async function saveEdit(item) {
    if (!draftIsValid || !draftIsDirty) return;

    const qty = Number(editDraft.quantity);
    const price = Number(editDraft.price);
    const safeDraft = {
      itemName: String(editDraft.itemName ?? "").trim(),
      quantity: Number.isFinite(qty) ? qty : 0,
      price: Number.isFinite(price) ? price : 0,
      location: String(editDraft.location ?? "").trim(),
    };

    const payload = {
      ...item,
      ...safeDraft,
      syncStatus: "pending",
      lastUpdated: new Date().toISOString(),
      conflictServer: null,
    };
    console.log("💾 Saving edit payload:", payload);

    const updated = await updateItem(payload);

    setInventory((prev) =>
      prev.map((inv) => (inv._id === updated._id ? updated : inv))
    );

    if (navigator.onLine) {
      try {
        await runFullSync(token);
      } finally {
        await refreshLocalActive();
      }
    }

    cancelEdit();
  }

  async function resolveKeepLocal(item) {
    const payload = {
      ...item,
      syncStatus: "pending",
      lastUpdated: new Date().toISOString(),
      conflictServer: null,
    };
    await updateItem(payload);
    await refreshLocalActive();
    if (navigator.onLine) {
      try {
        await runFullSync(token);
      } finally {
        await refreshLocalActive();
      }
    }
  }

  async function resolveUseServer(item) {
    const server = item.conflictServer || {};
    const payload = {
      ...item,
      itemName: server.itemName ?? item.itemName,
      quantity: typeof server.quantity === "number" ? server.quantity : item.quantity,
      price: typeof server.price === "number" ? server.price : item.price,
      location: server.location ?? item.location,
      syncStatus: "pending",
      lastUpdated: new Date().toISOString(),
      conflictServer: null,
    };
    await updateItem(payload);
    await refreshLocalActive();
    if (navigator.onLine) {
      try {
        await runFullSync(token);
      } finally {
        await refreshLocalActive();
      }
    }
  }

  // ===== Counts & filtering =====
  const counts = useMemo(() => {
    const base = {
      [LOCATION.C_STORE]: 0,
      [LOCATION.RESTAURANT]: 0,
    };
    if (!Array.isArray(inventory)) return base;
    for (const it of inventory) {
      const loc = normalizeLocation(it?.location);
      if (loc === LOCATION.C_STORE) base[LOCATION.C_STORE] += 1;
      else if (loc === LOCATION.RESTAURANT) base[LOCATION.RESTAURANT] += 1;
    }
    return base;
  }, [inventory]);

  useEffect(() => {
    if (typeof onCountsChange === "function") {
      onCountsChange(counts);
    }
  }, [counts, onCountsChange]);

  const displayItems = useMemo(() => {
    if (!Array.isArray(inventory)) return [];
    if (!locationFilter) return inventory;
    const target = normalizeLocation(locationFilter);
    return inventory.filter((it) => normalizeLocation(it?.location) === target);
  }, [inventory, locationFilter]);

  // ===== RENDER =====
  return (
    <div style={{ padding: 16 }}>
      <h2>Inventory</h2>

      {displayItems.length === 0 ? (
        <div style={{ opacity: 0.85, padding: '12px 0' }}>
          {locationFilter ? (
            <>No items found for <b>{locationFilter}</b>. Add your first item below.</>
          ) : (
            <>No items in inventory yet. Add your first item below.</>
          )}
        </div>
      ) : (
        <ul>
          {displayItems.map((item) => (
            <li key={item._id} style={{ borderBottom: '1px solid #eee', padding: '8px 0' }}>
              {editingId === item._id ? (
                <div>
                  <SyncStatusPill status={item.syncStatus} />

                  {item.syncStatus === "conflict" && item.conflictServer && (
                    <div style={{ margin: "6px 0", padding: "6px 8px", border: "1px dashed #f59e0b" }}>
                      <strong>Conflict:</strong> Server has different values.
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        <div>Mine → {editDraft.itemName} / {editDraft.quantity} / ${editDraft.price} / {editDraft.location}</div>
                        <div>Server → {String(item.conflictServer.itemName)} / {String(item.conflictServer.quantity)} / ${String(item.conflictServer.price)} / {String(item.conflictServer.location)}</div>
                      </div>
                      <div style={{ marginTop: 6 }}>
                        <button onClick={() => resolveKeepLocal(item)}>Keep Mine</button>{" "}
                        <button onClick={() => resolveUseServer(item)}>Use Server</button>
                      </div>
                    </div>
                  )}

                  <input
                    name="itemName"
                    value={editDraft.itemName}
                    onChange={onEditChange}
                    placeholder="Item Name"
                  />
                  <input
                    name="quantity"
                    type="number"
                    value={editDraft.quantity}
                    onChange={onEditChange}
                    placeholder="Quantity"
                  />
                  <input
                    name="price"
                    type="number"
                    step="0.01"
                    value={editDraft.price}
                    onChange={onEditChange}
                    placeholder="Price"
                  />
                  <input
                    name="location"
                    value={editDraft.location}
                    onChange={onEditChange}
                    placeholder="Location"
                  />

                  <button
                    onClick={() => saveEdit(item)}
                    disabled={!draftIsValid || !draftIsDirty}
                    title={
                      !draftIsValid
                        ? "Please enter a name, non-negative quantity and price."
                        : !draftIsDirty
                        ? "No changes to save."
                        : ""
                    }
                  >
                    Save
                  </button>
                  <button onClick={cancelEdit}>Cancel</button>
                </div>
              ) : (
                <div>
                  <SyncStatusPill status={item.syncStatus} />
                  {item.itemName} - {item.quantity} @ ${item.price} ({item.location})
                  {item.syncStatus === "conflict" && item.conflictServer && (
                    <div style={{ marginTop: 6 }}>
                      <div style={{ fontSize: 12, marginBottom: 4 }}>
                        <em>Server copy differs.</em>
                      </div>
                      <button onClick={() => resolveKeepLocal(item)}>Keep Mine</button>{" "}
                      <button onClick={() => resolveUseServer(item)}>Use Server</button>{" "}
                      <button onClick={() => startEdit(item)}>Review & Edit</button>
                    </div>
                  )}
                  {item.syncStatus !== "conflict" && (
                    <>
                      {" "}
                      <button onClick={() => startEdit(item)}>Edit</button>{" "}
                      <button onClick={() => handleDelete(item._id)}>Delete</button>
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <h3>Add New Item</h3>
      <form onSubmit={handleAddItem}>
        <input
          name="itemName"
          placeholder="Item Name"
          value={newItem.itemName}
          onChange={handleChange}
          required
        />
        <input
          name="quantity"
          type="number"
          placeholder="Quantity"
          value={newItem.quantity}
          onChange={handleChange}
          required
        />
        <input
          name="price"
          type="number"
          step="0.01"
          placeholder="Price"
          value={newItem.price}
          onChange={handleChange}
          required
        />
        <input
          name="location"
          placeholder="Location"
          value={newItem.location}
          onChange={handleChange}
          required
        />
        <button type="submit">Add Item</button>
      </form>
    </div>
  );
}