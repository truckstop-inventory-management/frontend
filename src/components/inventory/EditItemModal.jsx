// src/components/inventory/EditItemModal.jsx
import React from "react";
import BtnSpinner from "./BtnSpinner.jsx";

export default function EditItemModal({
                                        isOpen,
                                        editingItem,
                                        isSyncing,
                                        onEditField,
                                        onSave,
                                        onClose,
                                        modalRef,       // ref from parent (focus trap logic lives in parent)
                                        firstFieldRef,  // ref from parent (initial focus)
                                      }) {
  if (!isOpen || !editingItem) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-item-title"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* modal card */}
      <div
        ref={modalRef}
        className="relative z-10 w-full max-w-md rounded-2xl bg-[var(--color-surface)] shadow-xl border border-[var(--color-border)] p-4
                   transition transform duration-150 ease-out motion-reduce:transition-none motion-reduce:transform-none"
      >
        <h3 id="edit-item-title" className="text-lg font-semibold mb-3 text-[var(--color-text)]">
          Edit Item
        </h3>

        <div className="space-y-3">
          <div>
            <label htmlFor="edit-name" className="block text-sm text-[var(--color-text)]/80 mb-1">
              Name
            </label>
            <input
              id="edit-name"
              ref={firstFieldRef}
              className="w-full border border-[var(--color-border)] rounded p-2 h-10 text-sm bg-[var(--color-surface)] text-[var(--color-text)]
                         outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]
                         focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
              value={editingItem.itemName}
              onChange={(e) => onEditField("itemName", e.target.value)}
              disabled={isSyncing}
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label htmlFor="edit-qty" className="block text-sm text-[var(--color-text)]/80 mb-1">
                Quantity
              </label>
              <input
                id="edit-qty"
                type="number"
                className="w-full border border-[var(--color-border)] rounded p-2 h-10 text-sm bg-[var(--color-surface)] text-[var(--color-text)]
                           outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]
                           focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
                value={editingItem.quantity}
                onChange={(e) => onEditField("quantity", Number(e.target.value))}
                disabled={isSyncing}
              />
            </div>
            <div className="flex-1">
              <label htmlFor="edit-price" className="block text-sm text-[var(--color-text)]/80 mb-1">
                Price
              </label>
              <input
                id="edit-price"
                type="number"
                step="0.01"
                className="w-full border border-[var(--color-border)] rounded p-2 h-10 text-sm bg-[var(--color-surface)] text-[var(--color-text)]
                           outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]
                           focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
                value={editingItem.price}
                onChange={(e) => onEditField("price", e.target.value)}
                disabled={isSyncing}
              />
            </div>
          </div>

          <div>
            <label htmlFor="edit-location" className="block text-sm text-[var(--color-text)]/80 mb-1">
              Location
            </label>
            <select
              id="edit-location"
              className="w-full border border-[var(--color-border)] rounded p-2 h-10 text-sm bg-[var(--color-surface)] text-[var(--color-text)]
                         outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]
                         focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
              value={editingItem.location}
              onChange={(e) => onEditField("location", e.target.value)}
              disabled={isSyncing}
            >
              <option value="C-Store">C-Store</option>
              <option value="Restaurant">Restaurant</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded border border-[var(--color-border)] text-[var(--color-text)] h-10 text-sm min-w-[84px]
                       hover:bg-[var(--color-surface-2)]
                       outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]
                       focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
            title="Cancel Changes"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 rounded bg-[var(--color-primary)] text-white h-10 text-sm min-w-[84px] flex items-center
                       hover:opacity-90 active:opacity-100 disabled:opacity-50 disabled:cursor-not-allowed
                       outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]
                       focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
            disabled={isSyncing}
            title="Save Changes"
          >
            {isSyncing ? <BtnSpinner /> : null}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
