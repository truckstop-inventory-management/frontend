// src/hooks/useTotals.js
import { useMemo } from "react";

/**
 * Computes group totals and overall total from already-visible items.
 * Matches previous computation 1:1 (C-Store & Restaurant groups).
 */
export default function useTotals(visibleItems) {
  return useMemo(() => {
    const acc = { "C-Store": 0, Restaurant: 0 };
    for (const it of visibleItems || []) {
      const loc = acc[it?.location] !== undefined ? it.location : null;
      const price = Number(it?.price) || 0;
      const qty = Number(it?.quantity) || 0;
      if (loc) acc[loc] += price * qty;
    }
    const overall = (acc["C-Store"] || 0) + (acc["Restaurant"] || 0);
    return { totalsByGroup: acc, totalOverall: overall };
  }, [visibleItems]);
}
