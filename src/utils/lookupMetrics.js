// src/utils/lookupMetrics.js
//
// Lightweight in-memory metrics for cache/remote lookups.
// - No external deps
// - Safe in Vite/Capacitor (no process/env usage)
// - Resettable for tests
//
// Usage (after wiring in next step):
//   import { recordHit, recordMiss, recordLatency, getSnapshot, resetMetrics } from './lookupMetrics'
//   recordHit(); recordLatency(123); ...
//   console.log(getSnapshot());

const state = {
  hits: 0,
  misses: 0,
  errors: 0,
  samples: [], // latency in ms (numbers)
  startedAt: new Date().toISOString(),
  updatedAt: null,
};

function touch() {
  state.updatedAt = new Date().toISOString();
}

export function recordHit() {
  state.hits += 1;
  touch();
}

export function recordMiss() {
  state.misses += 1;
  touch();
}

export function recordError() {
  state.errors += 1;
  touch();
}

export function recordLatency(ms) {
  if (typeof ms === 'number' && Number.isFinite(ms) && ms >= 0) {
    state.samples.push(ms);
    touch();
  }
}

/** Compute simple percentiles without external libs. */
function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  const w = rank - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

export function getSnapshot() {
  const n = state.samples.length;
  const p50 = percentile(state.samples, 50);
  const p90 = percentile(state.samples, 90);
  const avg = n ? state.samples.reduce((a, b) => a + b, 0) / n : 0;

  return {
    counters: {
      hits: state.hits,
      misses: state.misses,
      errors: state.errors,
      totalLookups: state.hits + state.misses + state.errors,
    },
    latency: {
      count: n,
      avg,
      p50,
      p90,
      lastMs: n ? state.samples[n - 1] : 0,
    },
    startedAt: state.startedAt,
    updatedAt: state.updatedAt,
  };
}

export function resetMetrics() {
  state.hits = 0;
  state.misses = 0;
  state.errors = 0;
  state.samples = [];
  state.startedAt = new Date().toISOString();
  state.updatedAt = null;
}
