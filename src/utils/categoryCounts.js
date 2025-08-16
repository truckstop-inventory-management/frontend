// Centralized helpers for category-derived metrics.

export const CATEGORIES = ["C-Store", "Restaurant"];

/** Count items per category (ignores tombstoned items). */
export function countByCategory(items = []) {
  const counts = { "C-Store": 0, Restaurant: 0 };
  for (const it of items) {
    if (!it || it.isDeleted) continue;
    const cat = normalizeCategory(it.category);
    if (counts[cat] !== undefined) counts[cat] += 1;
  }
  return counts;
}

/** Sum (quantity * price) per category (ignores tombstoned items). */
export function totalValueByCategory(items = []) {
  const totals = { "C-Store": 0, Restaurant: 0 };
  for (const it of items) {
    if (!it || it.isDeleted) continue;
    const cat = normalizeCategory(it.category);
    const qty = Number(it.quantity) || 0;
    const price = Number(it.price) || 0;
    if (totals[cat] !== undefined) totals[cat] += qty * price;
  }
  return totals;
}

/** Normalize any incoming category strings to our two canonical values. */
function normalizeCategory(cat) {
  if (cat === "Restaurant") return "Restaurant";
  // Default bucket (also handles undefined/null/mismatched strings)
  return "C-Store";
}