// src/components/inventory/AddItemForm.jsx
import React from "react";

export default function AddItemForm({ newItem, setNewItem, onAdd, disabled }) {
  const onChange = (field) => (e) => {
    const val = e.target.value;
    setNewItem((prev) => ({ ...prev, [field]: val }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (disabled) return;
    onAdd(); // <- uses current newItem from state; no hard-coded payload
  };

  return (
    <form onSubmit={handleSubmit} className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-5">
      <input
        className="rounded border px-2 py-1"
        placeholder="Item name"
        value={newItem?.itemName || ""}
        onChange={onChange("itemName")}
        required
      />
      <input
        className="rounded border px-2 py-1"
        type="number"
        placeholder="Qty"
        value={newItem?.quantity ?? ""}
        onChange={onChange("quantity")}
        min="0"
        step="1"
        required
      />
      <input
        className="rounded border px-2 py-1"
        type="number"
        placeholder="Price"
        value={newItem?.price ?? ""}
        onChange={onChange("price")}
        min="0"
        step="0.01"
        required
      />
      <select
        className="rounded border px-2 py-1"
        value={newItem?.location || "C-Store"}
        onChange={onChange("location")}
        required
      >
        <option value="C-Store">C-Store</option>
        <option value="Restaurant">Restaurant</option>
      </select>
      <button
        type="submit"
        disabled={disabled}
        className="rounded bg-[var(--color-primary)] px-3 py-1 text-white disabled:opacity-60"
      >
        Add
      </button>
    </form>
  );
}
