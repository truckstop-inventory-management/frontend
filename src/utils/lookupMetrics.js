// src/utils/lookupMetrics.js

// -----------------------------------------------------------------------------
// In-memory lookup metrics (client-side only)
// Counts: hits / misses / errors
// Latency: rolling samples with p50 / p90
// Per-barcode: hits / misses / errors / lastSeenAt
// -----------------------------------------------------------------------------

// Keep this module purely in-memory; callers should treat as diagnostics only.
const metrics = {
  hits: 0,
  misses: 0,
  errors: 0,
  latency: { p50: null, p90: null },
  samples: [],          // number[] (milliseconds)
  perBarcode: Object.create(null), // { [barcode]: { hits, misses, errors, lastSeenAt } }
};

// Cap for the rolling latency buffer (keeps work small and stable)
const MAX_SAMPLES = 200;

// ----- utilities --------------------------------------------------------------

function clampNumber(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

function percentile(sortedAsc, p /* 0..100 */) {
  if (!sortedAsc.length) return null;
  const clamped = Math.min(Math.max(p, 0), 100);
  if (clamped === 0) return sortedAsc[0];
  if (clamped === 100) return sortedAsc[sortedAsc.length - 1];

  const idx = (clamped / 100) * (sortedAsc.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];

  const w = idx - lo;
  return sortedAsc[lo] * (1 - w) + sortedAsc[hi] * w;
}

function recomputeLatency() {
  if (!metrics.samples.length) {
    metrics.latency.p50 = null;
    metrics.latency.p90 = null;
    return;
  }
  // Work on a copy to keep insertion order of the main buffer
  const sorted = metrics.samples.slice().sort((a, b) => a - b);
  metrics.latency.p50 = Math.max(0, Math.round(percentile(sorted, 50)));
  metrics.latency.p90 = Math.max(0, Math.round(percentile(sorted, 90)));
}

// ----- core API ---------------------------------------------------------------

/**
 * Record a latency sample (in ms) and update p50/p90.
 * Exported because some callers want to record latency independent of hit/miss.
 */
export function recordLatency(ms = 0) {
  const v = clampNumber(ms);
  // Accept zero and small numbers; they’re valid local hits
  metrics.samples.push(v);
  if (metrics.samples.length > MAX_SAMPLES) metrics.samples.shift();
  recomputeLatency();
}

/**
 * Record an event of a given type with optional barcode and latency.
 * type ∈ {'hits','misses','errors'}
 */
export function recordEvent(type, barcode, latencyMs = 0) {
  if (type === 'hits' || type === 'misses' || type === 'errors') {
    metrics[type] = (metrics[type] || 0) + 1;
  }
  // Update latency buffer if provided (>= 0)
  if (latencyMs != null) {
    recordLatency(latencyMs);
  }

  // Per-barcode aggregation
  if (barcode) {
    let row = metrics.perBarcode[barcode];
    if (!row) {
      row = { hits: 0, misses: 0, errors: 0, lastSeenAt: 0 };
      metrics.perBarcode[barcode] = row;
    }
    if (type === 'hits' || type === 'misses' || type === 'errors') {
      row[type] = (row[type] || 0) + 1;
    }
    row.lastSeenAt = Date.now();
  }
}

/** Compatibility wrappers that some modules import directly */
export function recordHit(barcode, latencyMs = 0)   { recordEvent('hits',   barcode, latencyMs); }
export function recordMiss(barcode, latencyMs = 0)  { recordEvent('misses', barcode, latencyMs); }
export function recordError(barcode, latencyMs = 0) { recordEvent('errors', barcode, latencyMs); }

/** Read-only snapshot of all metrics */
export function getSnapshot() {
  // Deep-ish copy to avoid accidental external mutation
  return JSON.parse(JSON.stringify(metrics));
}

/** Array of per-barcode rows for display (copy, sorted by recency) */
export function getPerBarcodeStats() {
  try {
    const rows = Object.entries(metrics.perBarcode).map(([barcode, v]) => ({
      barcode,
      hits: v.hits || 0,
      misses: v.misses || 0,
      errors: v.errors || 0,
      lastSeenAt: v.lastSeenAt || 0,
    }));
    // newest first
    rows.sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0));
    return rows;
  } catch {
    return [];
  }
}

/** Reset everything (kept for compatibility) */
export function resetMetrics() {
  metrics.hits = 0;
  metrics.misses = 0;
  metrics.errors = 0;
  metrics.latency.p50 = null;
  metrics.latency.p90 = null;
  metrics.samples = [];
  metrics.perBarcode = Object.create(null);
}

/** Alias some callers might use */
export const reset = resetMetrics;

// Optional: expose raw samples for debugging (not used by UI)
export function getSamples() {
  return metrics.samples.slice();
}

// --- Histogram helper (client-side) ---------------------------------------
/**
 * Build a latency histogram from rolling samples.
 * @param {number[]} bins - ascending edges in ms, e.g. [0,10,25,50,100,250,500,1000]
 * Produces bins: [0-10), [10-25), ... , [1000-∞)
 * Returns: Array<{label, from, to, count, pct}>
 */
export function getHistogram(bins = [0,10,25,50,100,250,500,1000]) {
  try {
    const samples = typeof getSamples === 'function' ? getSamples() : [];
    const N = samples.length;
    const edges = Array.isArray(bins) && bins.length
      ? [...bins].sort((a,b)=>a-b)
      : [0,10,25,50,100,250,500,1000];

    const counts = new Array(edges.length + 1).fill(0); // last bin is > last edge

    for (let i = 0; i < N; i++) {
      const s = samples[i];
      // Support both numeric samples (current design) and future object-shaped samples
      const ms = (typeof s === 'number')
        ? s
        : (typeof s?.latencyMs === 'number'
          ? s.latencyMs
          : (typeof s?.meta?.latencyMs === 'number' ? s.meta.latencyMs : null));
      if (ms == null || Number.isNaN(ms)) continue;

      // find the first edge strictly greater than ms -> bin is its index
      let idx = edges.findIndex(e => ms < e);
      if (idx === -1) idx = edges.length; // overflow bin
      counts[idx]++;
    }

    // shape result with labels
    const result = [];
    const denom = counts.reduce((a,b)=>a+b,0) || 1;
    for (let i = 0; i < counts.length; i++) {
      const from = i === 0 ? 0 : edges[i-1];
      const to = i < edges.length ? edges[i] : Infinity;
      const label = i < edges.length ? `${from}–${to} ms` : `>${edges[edges.length-1]} ms`;
      const count = counts[i];
      const pct = +((count / denom) * 100).toFixed(1);
      result.push({ label, from, to, count, pct });
    }
    return result;
  } catch (err) {
    // Never break the dashboard—return empty bins for given edges.
    const edges = Array.isArray(bins) && bins.length ? [...bins].sort((a,b)=>a-b) : [0,10,25,50,100,250,500,1000];
    const empty = [];
    for (let i = 0; i <= edges.length; i++) {
      const from = i === 0 ? 0 : edges[i-1];
      const to = i < edges.length ? edges[i] : Infinity;
      const label = i < edges.length ? `${from}–${to} ms` : `>${edges[edges.length-1]} ms`;
      empty.push({ label, from, to, count: 0, pct: 0 });
    }
    return empty;
  }
}
