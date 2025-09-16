// src/components/inventory/AddItemForm.jsx
import React from "react";
import BtnSpinner from "./BtnSpinner.jsx";

export default function AddItemForm({ newItem, setNewItem, onAdd, disabled }) {
  return (
    <div className="flex gap-2 mb-4 flex-wrap">
      <input
        className="border border-[var(--color-border)] p-2 rounded bg-[var(--color-surface)] text-[var(--color-text)] min-w-[160px] h-10 text-sm
                   outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]
                   focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
        placeholder="Item Name"
        aria-label="New item name"
        value={newItem.itemName}
        onChange={(e) => setNewItem({ ...newItem, itemName: e.target.value })}
        disabled={disabled}
      />
      <input
        type="number"
        className="border border-[var(--color-border)] p-2 rounded bg-[var(--color-surface)] text-[var(--color-text)] w-24 h-10 text-sm
                   outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]
                   focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
        placeholder="Qty"
        aria-label="New item quantity"
        value={newItem.quantity}
        onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })}
        disabled={disabled}
        min={0}
        step={1}
        inputMode="numeric"
      />
      <input
        type="number"
        step="0.01"
        className="border border-[var(--color-border)] p-2 rounded bg-[var(--color-surface)] text-[var(--color-text)] w-28 h-10 text-sm
                   outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]
                   focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
        placeholder="Price"
        aria-label="New item price"
        value={newItem.price}
        onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
        disabled={disabled}
        min={0}
        inputMode="decimal"
      />
      <select
        className="border border-[var(--color-border)] p-2 rounded bg-[var(--color-surface)] text-[var(--color-text)] h-10 text-sm
                   outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]
                   focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
        aria-label="New item location"
        value={newItem.location}
        onChange={(e) => setNewItem({ ...newItem, location: e.target.value })}
        disabled={disabled}
      >
        <option value="C-Store">C-Store</option>
        <option value="Restaurant">Restaurant</option>
      </select>
      <button
        onClick={onAdd}
        aria-label="Add item"
        className="bg-[var(--color-success)] text-white px-4 py-2 rounded h-10 text-sm
                   outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]
                   focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]
                   hover:opacity-90 active:opacity-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        disabled={disabled}
        title="Add Item"
      >
        {disabled ? <BtnSpinner /> : null}
        Add
      </button>
    </div>
  );
}
