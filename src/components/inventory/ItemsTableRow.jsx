// src/components/inventory/ItemsTableRow.jsx
import React from "react";
import SyncStatusPill from "../../components/SyncStatusPill.jsx";

function Row({
               item,
               idx,
               isSyncing,
               onUpdateItem,
               onOpenEdit,
               longPressHandlers,
             }) {
  const rowStripe =
    idx % 2 === 0 ? "bg-transparent" : "bg-[var(--color-surface-2)]";

  return (
    <tr
      className={`text-center ${rowStripe} hover:bg-[var(--color-surface-2)] transition-colors align-middle`}
    >
      <td
        className="border border-[var(--color-border)] px-2 py-2 text-sm text-left whitespace-nowrap"
        style={{ width: "1%" }}
      >
        {item.itemName}
      </td>

      <td className="border border-[var(--color-border)] px-2 py-2 text-sm">
        <input
          type="number"
          value={item.quantity}
          aria-label={`Quantity for ${item.itemName}`}
          onChange={(e) =>
            onUpdateItem(item._id, "quantity", Number(e.target.value))
          }
          className="border border-[var(--color-border)] p-1 w-16 h-8 text-sm bg-[var(--color-surface)] text-[var(--color-text)]
                     outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]
                     focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
          disabled={isSyncing}
          min={0}
          step={1}
          inputMode="numeric"
        />
      </td>

      <td className="border border-[var(--color-border)] px-2 py-2 text-sm">
        <input
          type="number"
          step="0.01"
          value={item.price}
          aria-label={`Price for ${item.itemName}`}
          onChange={(e) => onUpdateItem(item._id, "price", e.target.value)}
          className="border border-[var(--color-border)] p-1 w-20 h-8 text-sm bg-[var(--color-surface)] text-[var(--color-text)]
                     outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]
                     focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
          disabled={isSyncing}
          min={0}
          inputMode="decimal"
        />
      </td>

      <td className="border border-[var(--color-border)] px-2 py-2 text-sm">
        <select
          value={item.location}
          aria-label={`Location for ${item.itemName}`}
          onChange={(e) => onUpdateItem(item._id, "location", e.target.value)}
          className="border border-[var(--color-border)] p-1 h-8 text-sm bg-[var(--color-surface)] text-[var(--color-text)]
                     outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]
                     focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
          disabled={isSyncing}
        >
          <option value="C-Store">C-Store</option>
          <option value="Restaurant">Restaurant</option>
        </select>
      </td>

      <td className="border border-[var(--color-border)] px-2 py-2 text-sm">
        <SyncStatusPill
          status={item.syncStatus}
          ariaLabel={`${item.itemName} is ${String(item.syncStatus || "unknown")}`}
        />
      </td>

      <td className="border border-[var(--color-border)] px-2 py-2 text-sm space-x-2">
        <button
          onClick={onOpenEdit}
          className="bg-[var(--color-primary)] text-white px-3 py-1 rounded h-8 text-sm min-w-[72px]
                     outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]
                     focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
          title="Edit Item"
          aria-label={`Edit ${item.itemName}`}
          disabled={isSyncing}
        >
          Edit
        </button>
        <button
          {...longPressHandlers}
          className="bg-[var(--color-danger)] text-white px-3 py-1 rounded h-8 text-sm min-w-[72px]
                     outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]
                     focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
          title="Delete Item (Press and Hold)"
          aria-label={`Delete ${item.itemName} (press and hold)`}
          disabled={isSyncing}
        >
          Delete
        </button>
      </td>
    </tr>
  );
}

// Memoize so only changed rows re-render.
// We compare by item identity and a few scalars.
function areEqual(prev, next) {
  const a = prev.item;
  const b = next.item;
  return (
    prev.idx === next.idx &&
    prev.isSyncing === next.isSyncing &&
    a === b && // identity check (you update immutably)
    prev.onUpdateItem === next.onUpdateItem &&
    prev.onOpenEdit === next.onOpenEdit
  );
}

export default React.memo(Row, areEqual);
