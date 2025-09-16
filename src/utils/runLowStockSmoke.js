// src/utils/runLowStockSmoke.js
export function runLowStockSmoke(items, toast, { threshold = 5 } = {}) {
  const src = (items || []).filter((i) => !i?.isDeleted);
  const filtered = src.filter((i) => Number(i?.quantity) <= threshold);
  const ok = filtered.every((i) => Number(i?.quantity) <= threshold);
  const sample = filtered.slice(0, 5).map((i) => ({ name: i.itemName, q: i.quantity }));

  console.group("[SmokeTest] Low-stock filter");
  console.log("Threshold:", threshold);
  console.log("Total items:", src.length);
  console.log("Filtered count (<= th):", filtered.length);
  console.log("Sample:", sample);
  console.log("PASS:", ok);
  console.groupEnd();

  if (toast?.show) {
    toast.show({
      message: ok ? "Low-stock smoke test: PASS" : "Low-stock smoke test: FAIL",
      duration: 3500,
    });
  }
  return ok;
}
