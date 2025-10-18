// src/features/barcode/metrics.ts
type MetricsState = {
  successCount: number;
  missCount: number;
  totalMs: number;
};

const KEY = 'barcode_metrics_v1';

function load(): MetricsState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as MetricsState;
  } catch {}
  return { successCount: 0, missCount: 0, totalMs: 0 };
}

function save(m: MetricsState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {}
}

export function recordSuccess(ms: number) {
  const m = load();
  m.successCount += 1;
  m.totalMs += Math.max(0, Math.round(ms));
  save(m);
}

export function recordMiss() {
  const m = load();
  m.missCount += 1;
  save(m);
}

export function getSummary() {
  const m = load();
  const avgMs = m.successCount ? Math.round(m.totalMs / m.successCount) : 0;
  return { ...m, avgMs };
}

export function resetMetrics() {
  save({ successCount: 0, missCount: 0, totalMs: 0 });
}
