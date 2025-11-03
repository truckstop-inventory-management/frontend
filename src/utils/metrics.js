// src/utils/metrics.js
// Dev metrics for barcode scanning: counts + rolling durations + percentiles.
const KEY = 'tsinv:scanMetrics';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : { success: 0, miss: 0, durations: [] };
  } catch {
    return { success: 0, miss: 0, durations: [] };
  }
}
function save(d) {
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {}
}

export function recordSuccess(durationMs) {
  const d = load();
  d.success += 1;
  if (typeof durationMs === 'number' && isFinite(durationMs) && durationMs >= 0) {
    d.durations.push(Math.round(durationMs));
    if (d.durations.length > 200) d.durations.splice(0, d.durations.length - 200); // cap
  }
  save(d);
  return d;
}
export function recordMiss() {
  const d = load();
  d.miss += 1; save(d); return d;
}
export function resetMetrics() { save({ success: 0, miss: 0, durations: [] }); }

function percentile(arr, p) {
  if (!arr.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  const idx = Math.min(a.length - 1, Math.max(0, Math.floor((p / 100) * (a.length - 1))));
  return a[idx];
}
export function summary() {
  const d = load();
  const avg = d.durations.length ? Math.round(d.durations.reduce((s, x) => s + x, 0) / d.durations.length) : 0;
  const p50 = percentile(d.durations, 50);
  const p90 = percentile(d.durations, 90);
  const out = { ...d, avg, p50, p90 };
  if (typeof window !== 'undefined') window.debug = { ...window.debug, scanMetrics: out };
  return out;
}
