// src/components/inventory/SortFilterBar.jsx
import React from "react";

export default function SortFilterBar({
                                        sortBy, setSortBy,
                                        sortDir, setSortDir,
                                        inStockOnly, setInStockOnly,
                                        showLowStockOnly, setShowLowStockOnly,
                                        lowStockThreshold, setLowStockThreshold,
                                      }) {
  return (
    <div className="flex flex-wrap items-center gap-3 gap-y-2 mb-3">
      <div className="flex items-center gap-2">
        <label className="text-sm text-[var(--color-text)]">Sort</label>
        <select
          value={sortBy}
          aria-label="Sort by"
          onChange={(e) => setSortBy(e.target.value)}
          className="border border-[var(--color-border)] p-2 rounded bg-[var(--color-surface)] text-[var(--color-text)] h-10 text-sm
                     outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]
                     focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
        >
          <option value="itemName">Name</option>
          <option value="quantity">Quantity</option>
          <option value="price">Price</option>
        </select>

        <select
          value={sortDir}
          aria-label="Sort direction"
          onChange={(e) => setSortDir(e.target.value)}
          className="border border-[var(--color-border)] p-2 rounded bg-[var(--color-surface)] text-[var(--color-text)] h-10 text-sm
                     outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]
                     focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
        >
          <option value="asc">Asc</option>
          <option value="desc">Desc</option>
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
        <input
          type="checkbox"
          checked={inStockOnly}
          onChange={(e) => setInStockOnly(e.target.checked)}
          className="h-5 w-5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]
                     focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
          aria-label="In Stock Only"
        />
        In Stock Only
      </label>

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
          <input
            type="checkbox"
            checked={showLowStockOnly}
            onChange={(e) => setShowLowStockOnly(e.target.checked)}
            className="h-5 w-5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]
                       focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
            aria-label="Low Stock Only"
          />
          Low Stock Only
        </label>

        <label
          className="flex items-center gap-2 text-sm text-[var(--color-text)]"
          title="Show items with quantity at or below this number"
        >
          Threshold:
          <input
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={lowStockThreshold}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              setLowStockThreshold(Number.isFinite(v) && v >= 0 ? v : 0);
            }}
            className="border border-[var(--color-border)] p-2 rounded bg-[var(--color-surface)] text-[var(--color-text)] w-24 h-10 text-sm
                       outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]
                       focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
            aria-label="Threshold"
          />
        </label>
      </div>
    </div>
  );
}
