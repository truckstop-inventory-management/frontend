import React, { useEffect, useState } from "react";
import { getAllItems, addItem, updateItem, deleteItem } from "../utils/db.js";
import SyncStatusPill from "../components/SyncStatusPill.jsx";

const InventoryList = ({ dbReady, onMetricsChange }) => {
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState({
    itemName: "",
    quantity: 0,
    price: "",
    location: "C-Store",
  });

  // Load items when dbReady changes (not on every items.length change)
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

  const handleDeleteItem = async (id) => {
    await deleteItem(id);
    setItems(items.filter((i) => i._id !== id));
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Inventory List</h2>

      {/* Add Item */}
      <div className="flex gap-2 mb-4">
        <input
          className="border p-2 rounded"
          placeholder="Item Name"
          value={newItem.itemName}
          onChange={(e) => setNewItem({ ...newItem, itemName: e.target.value })}
        />
        <input
          type="number"
          className="border p-2 rounded"
          placeholder="Qty"
          value={newItem.quantity}
          onChange={(e) =>
            setNewItem({ ...newItem, quantity: Number(e.target.value) })
          }
        />
        <input
          type="number"
          step="0.01"
          className="border p-2 rounded"
          placeholder="Price"
          value={newItem.price}
          onChange={(e) =>
            setNewItem({ ...newItem, price: e.target.value })
          }
        />
        <select
          className="border p-2 rounded"
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
          className="bg-green-500 text-white px-4 py-2 rounded"
        >
          Add
        </button>
      </div>

      {/* Items List */}
      <table className="w-full border">
        <thead>
        <tr className="bg-gray-200">
          <th className="border p-2">Name</th>
          <th className="border p-2">Qty</th>
          <th className="border p-2">Price</th>
          <th className="border p-2">Location</th>
          <th className="border p-2">Status</th>
          <th className="border p-2">Actions</th>
        </tr>
        </thead>
        <tbody>
        {items.map((i) => (
          <tr key={i._id} className="text-center">
            <td className="border p-2">{i.itemName}</td>
            <td className="border p-2">
              <input
                type="number"
                value={i.quantity}
                onChange={(e) =>
                  handleUpdateItem(i._id, "quantity", Number(e.target.value))
                }
                className="border p-1 w-16"
              />
            </td>
            <td className="border p-2">
              <input
                type="number"
                step="0.01"
                value={i.price}
                onChange={(e) =>
                  handleUpdateItem(i._id, "price", e.target.value)
                }
                className="border p-1 w-20"
              />
            </td>
            <td className="border p-2">
              <select
                value={i.location}
                onChange={(e) =>
                  handleUpdateItem(i._id, "location", e.target.value)
                }
                className="border p-1"
              >
                <option value="C-Store">C-Store</option>
                <option value="Restaurant">Restaurant</option>
              </select>
            </td>
            <td className="border p-2">
              <SyncStatusPill status={i.syncStatus} />
            </td>
            <td className="border p-2">
              <button
                onClick={() => handleDeleteItem(i._id)}
                className="bg-red-500 text-white px-2 py-1 rounded"
              >
                Delete
              </button>
            </td>
          </tr>
        ))}
        </tbody>
      </table>
    </div>
  );
};

export default InventoryList;