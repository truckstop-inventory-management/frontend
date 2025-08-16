import React, { useEffect, useState } from "react";
import { getAllItems, addItem, updateItem, deleteItem } from "../utils/db.js";
import SyncStatusPill from "../components/SyncStatusPill.jsx";

export default function InventoryList({ token, dbReady, locationFilter, onMetricsChange }) {
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState({
    itemName: "",
    quantity: "",
    price: "",
    location: "",
  });
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({});

  // Load items from IndexedDB
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
  }, [dbReady, items.length]);

  function handleChange(e) {
    setNewItem({ ...newItem, [e.target.name]: e.target.value });
  }

  async function handleAddItem(e) {
    e.preventDefault();
    const item = {
      ...newItem,
      quantity: parseInt(newItem.quantity),
      price: parseFloat(newItem.price),
      lastUpdated: new Date().toISOString(),
      syncStatus: "pending",
      isDeleted: false,
    };
    await addItem(item);
    setNewItem({ itemName: "", quantity: "", price: "", location: "" });
    setItems(await getAllItems());
  }

  async function handleDelete(id) {
    await deleteItem(id);
    setItems(await getAllItems());
  }

  function startEdit(item) {
    setEditingId(item._id);
    setEditDraft({ ...item });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft({});
  }

  function onEditChange(e) {
    setEditDraft({ ...editDraft, [e.target.name]: e.target.value });
  }

  async function saveEdit(item) {
    const updated = {
      ...item,
      ...editDraft,
      quantity: parseInt(editDraft.quantity),
      price: parseFloat(editDraft.price),
      lastUpdated: new Date().toISOString(),
      syncStatus: "pending",
    };
    await updateItem(updated);
    setEditingId(null);
    setEditDraft({});
    setItems(await getAllItems());
  }

  // --- Conflict Resolution ---
  async function resolveKeepLocal(item) {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/inventory/${item._id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            itemName: item.itemName,
            quantity: item.quantity,
            price: item.price,
            location: item.location,
            lastUpdated: new Date().toISOString(), // bump timestamp
          }),
        }
      );

      if (res.ok) {
        const serverItem = await res.json();
        await updateItem({ ...serverItem, syncStatus: "synced", isDeleted: false });
        console.log("✅ Conflict resolved: kept local");
        setItems(await getAllItems());
      }
    } catch (err) {
      console.error("❌ Error resolving keep local:", err);
    }
  }

  async function resolveUseServer(item) {
    try {
      await updateItem({
        ...item.conflictServer,
        syncStatus: "synced",
        isDeleted: false,
      });
      console.log("✅ Conflict resolved: used server copy");
      setItems(await getAllItems());
    } catch (err) {
      console.error("❌ Error resolving use server:", err);
    }
  }

  // ---- Render ----
  const displayItems = locationFilter
    ? items.filter((i) => i.location === locationFilter)
    : items;

  return (
    <div style={{ padding: 16 }}>
      <h2>Inventory</h2>

      {displayItems.length === 0 ? (
        <div style={{ opacity: 0.85, padding: "12px 0" }}>
          {locationFilter ? (
            <>No items found for <b>{locationFilter}</b>. Add your first item below.</>
          ) : (
            <>No items in inventory yet. Add your first item below.</>
          )}
        </div>
      ) : (
        <ul>
          {displayItems.map((item) => (
            <li key={item._id} style={{ borderBottom: "1px solid #eee", padding: "8px 0" }}>
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

                  <input name="itemName" value={editDraft.itemName} onChange={onEditChange} placeholder="Item Name" />
                  <input name="quantity" type="number" value={editDraft.quantity} onChange={onEditChange} placeholder="Quantity" />
                  <input name="price" type="text" value={editDraft.price} onChange={onEditChange} placeholder="Price" />
                  <input name="location" value={editDraft.location} onChange={onEditChange} placeholder="Location" />

                  <button onClick={() => saveEdit(item)}>Save</button>
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
        <input name="itemName" placeholder="Item Name" value={newItem.itemName} onChange={handleChange} required />
        <input name="quantity" type="number" placeholder="Quantity" value={newItem.quantity} onChange={handleChange} required />
        <input name="price" type="text" placeholder="Price" value={newItem.price} onChange={handleChange} required />
        <input name="location" placeholder="Location" value={newItem.location} onChange={handleChange} required />
        <button type="submit">Add Item</button>
      </form>
    </div>
  );
}