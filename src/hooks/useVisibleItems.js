// src/hooks/useVisibleItems.js
import { useMemo } from "react";

/**
 * Derives the visible, sorted list from items + UI prefs.
 * Matches the previous logic exactly.
 */
export default function useVisibleItems(items, {
  inStockOnly,
  showLowStockOnly,
  lowStockThreshold,
  sortBy,
  sortDir,
}) {
  return useMemo(() => {
    let list = (items || []).filter((i) => !i?.isDeleted);

    if (inStockOnly) {
      list = list.filter((i) => Number(i?.quantity) > 0);
    }

    if (showLowStockOnly) {
      const th = Number.isFinite(lowStockThreshold) ? lowStockThreshold : 5;
      list = list.filter((i) => Number(i?.quantity) <= th);
    }

    const dir = sortDir === "desc" ? -1 : 1;
    list = [...list].sort((a, b) => {
      const av = sortBy === "itemName" ? (a.itemName || "") : Number(a?.[sortBy] ?? 0);
      const bv = sortBy === "itemName" ? (b.itemName || "") : Number(b?.[sortBy] ?? 0);

      if (sortBy === "itemName") {
        return av.localeCompare(bv) * dir;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });

    return list;
  }, [items, inStockOnly, showLowStockOnly, lowStockThreshold, sortBy, sortDir]);
}
