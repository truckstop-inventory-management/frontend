// src/utils/cacheFirstLookup.js
//
// Orchestrates a cache-first lookup:
// 1) getCachedBarcode(barcode)
// 2) if found → return it (hit: true)
// 3) if not found → fetchRemoteBarcode(barcode)
//    - on ok → mergeAndSaveBarcodeCache(barcode, data) and return merged
//    - on miss/error → return null with status/info
//
// Now instrumented with lightweight metrics in lookupMetrics.js.

import { getCachedBarcode } from './barcodeCache';
import { fetchRemoteBarcode } from './fetchRemoteBarcode';
import { mergeAndSaveBarcodeCache } from './mergeCacheRecords';
import {
  recordHit,
  recordMiss,
  recordError,
  recordLatency,
} from './lookupMetrics';

/**
 * Cache-first lookup with basic metrics.
 *
 * @param {string} barcode
 * @param {Object} [opts]
 * @param {number} [opts.minLatencyMs]
 * @param {number} [opts.maxLatencyMs]
 * @param {'none'|'404'|'429'|'500'} [opts.forceError]
 * @returns {Promise<{
 *   ok: boolean,
 *   hit: boolean,
 *   status: number,
 *   record: object|null,
 *   error?: string,
 *   meta: { startedAt: string, finishedAt: string, ms: number }
 * }>}
 */
export async function cacheFirstLookup(barcode, opts = {}) {
  const started = performance.now();
  const startedAt = new Date().toISOString();

  // 1) Local cache
  const local = await getCachedBarcode(barcode);
  if (local) {
    const finishedAt = new Date().toISOString();
    const ms = Math.max(0, performance.now() - started);

    // metrics
    recordHit();
    recordLatency(ms);

    return {
      ok: true,
      hit: true,
      status: 200,
      record: local,
      meta: { startedAt, finishedAt, ms },
    };
  }

  // 2) Remote fetch (cache miss)
  const res = await fetchRemoteBarcode(barcode, opts);

  if (!res.ok) {
    const finishedAt = new Date().toISOString();
    const ms = Math.max(0, performance.now() - started);

    // metrics
    recordMiss();     // cache miss
    recordError();    // remote failed
    recordLatency(ms);

    return {
      ok: false,
      hit: false,
      status: res.status,
      record: null,
      error: res.error,
      meta: { startedAt, finishedAt, ms },
    };
  }

  // 3) Merge & persist
  const merged = await mergeAndSaveBarcodeCache(barcode, res.data);

  const finishedAt = new Date().toISOString();
  const ms = Math.max(0, performance.now() - started);

  // metrics
  recordMiss();     // cache miss (remote succeeded)
  recordLatency(ms);

  return {
    ok: true,
    hit: false,
    status: 200,
    record: merged,
    meta: { startedAt, finishedAt, ms },
  };
}
