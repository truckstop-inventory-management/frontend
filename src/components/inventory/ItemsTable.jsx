// src/components/inventory/ItemsTable.jsx
import React from "react";
import ItemsTableRow from "./ItemsTableRow.jsx";
import { COLUMNS } from "./columns.js";

function Table({
                 items,
                 isSyncing,
                 onUpdateItem,
                 onOpenEditModal,
                 createLongPressHandlers,
                 onDeleteItem,
               }) {
  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="w-full border border-[var(--color-border)] table-auto">
        <thead>
        <tr className="bg-[var(--color-surface-2)] text-[var(--color-text)] align-middle">
          {COLUMNS.map((col) => (
            <th
              key={col.key}
              scope="col"
              className={[
                "border border-[var(--color-border)] px-2 py-2 text-sm",
                col.thClass || "",
                col.width || "",
              ].join(" ").trim()}
              style={col.style}
            >
              {col.label}
            </th>
          ))}
        </tr>
        </thead>

        <tbody className="text-[var(--color-text)]">
        {items.map((it, idx) => (
          <ItemsTableRow
            key={it._id}
            item={it}
            idx={idx}
            isSyncing={isSyncing}
            onUpdateItem={onUpdateItem}
            onOpenEdit={(e) => onOpenEditModal(it, e)}
            longPressHandlers={createLongPressHandlers(it._id, () => onDeleteItem(it._id))}
          />
        ))}
        </tbody>
      </table>
    </div>
  );
}

export default React.memo(Table);
