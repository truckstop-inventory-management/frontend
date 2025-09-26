// src/components/inventory/EditItemModal.jsx
import React, { useEffect } from "react";

export default function EditItemModal({
                                        isOpen,
                                        editingItem,
                                        isSyncing,
                                        onEditField,
                                        onSave,
                                        onClose,
                                        modalRef,
                                        firstFieldRef,
                                      }) {
  if (!isOpen) return null;

  // Focus only once when the modal opens; do not re-focus on every render
  useEffect(() => {
    if (
      isOpen &&
      firstFieldRef &&
      firstFieldRef.current &&
      typeof firstFieldRef.current.focus === "function"
    ) {
      firstFieldRef.current.focus();
    }
  }, [isOpen, firstFieldRef]);

  const onChange =
    (field) =>
      (e) => {
        const v = e && e.target ? e.target.value : "";
        onEditField(field, field === "quantity" ? Number(v) : v);
      };

  const itemNameVal =
    editingItem ? (editingItem.itemName ? editingItem.itemName : "") : "";
  const qtyVal =
    editingItem && typeof editingItem.quantity !== "undefined"
      ? Number(editingItem.quantity || 0)
      : 0;
  const priceVal =
    editingItem && editingItem.price !== undefined && editingItem.price !== null
      ? editingItem.price
      : "";
  const locationVal =
    editingItem && editingItem.location ? editingItem.location : "C-Store";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-item-title"
    >
      <div
        ref={modalRef}
        className="w-full max-w-md rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-xl p-6"
      >
        <h2 id="edit-item-title" className="text-xl font-semibold mb-4">
          Edit Item
        </h2>

        {/* Item Name */}
        <div className="mb-4">
          <label className="block text-sm mb-1" htmlFor="edit-item-name">
            Item Name
          </label>
          <input
            id="edit-item-name"
            ref={firstFieldRef}
            type="text"
            className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800"
            value={itemNameVal}
            onChange={onChange("itemName")}
          />
        </div>

        {/* Quantity */}
        <div className="mb-4">
          <label className="block text-sm mb-1" htmlFor="edit-item-qty">
            Quantity
          </label>
          <input
            id="edit-item-qty"
            type="number"
            inputMode="numeric"
            className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800"
            min="0"
            step="1"
            value={qtyVal}
            onChange={onChange("quantity")}
          />
        </div>

        {/* Price */}
        <div className="mb-4">
          <label className="block text-sm mb-1" htmlFor="edit-item-price">
            Price
          </label>
          <input
            id="edit-item-price"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800"
            value={priceVal}
            onChange={onChange("price")}
          />
        </div>

        {/* Location */}
        <div className="mb-6">
          <label className="block text-sm mb-1" htmlFor="edit-item-location">
            Location
          </label>
          <select
            id="edit-item-location"
            className="w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-800"
            value={locationVal}
            onChange={onChange("location")}
          >
            <option value="C-Store">C-Store</option>
            <option value="Restaurant">Restaurant</option>
          </select>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700"
            disabled={isSyncing}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            disabled={isSyncing}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
