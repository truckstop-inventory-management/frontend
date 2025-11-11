// src/utils/cacheFirstLookup.js

import { getCachedBarcode, upsertRemoteEnrichment } from './barcodeCache';
import { fetchRemoteBarcode } from './fetchRemoteBarcode';
import {
  recordHit,
  recordMiss,
  recordError,
  recordLatency,
} from './lookupMetrics';

/**
 * Cache-first lookup:
 *  1) Try local cache via getCachedBarcode().
 *  2) On miss, fetchRemoteBarcode() then upsertRemoteEnrichment() (non-destructive).
 *  3) Record hit/miss/error and latency samples for local + remote legs.
 *  4) Never overwrites cache on remote error.
 *
 * @param {string} barcode
 * @param {object} opts passthrough flags for fetchRemoteBarcode (e.g., { forceError: true })
 * @returns {Promise<{ok:boolean, hit:boolean, status:number, record:any|null, error?:string, meta?:object}>}
 */
export async function cacheFirstLookup(barcode, opts = {}) {
  const now = typeof performance !== 'undefined' && performance.now ? () => performance.now() : () => Date.now();
  const t0 = now();

  try {
    // 1️⃣ Local cache check
    const local = await getCachedBarcode(barcode);
    const t1 = now();

    if (local) {
      // Cache HIT (record local latency)
      recordHit(barcode, t1 - t0);
      return {
        ok: true,
        hit: true,
        status: 200,
        record: local,
        meta: { source: 'cache', latencyMs: t1 - t0 },
      };
    }

    // Cache MISS (record time spent reaching the miss)
    recordMiss(barcode, t1 - t0);

    // 2️⃣ Remote fetch (always record remote latency sample)
    const r0 = now();
    const remote = await fetchRemoteBarcode(barcode, opts);
    const r1 = now();
    recordLatency(r1 - r0);

    if (!remote?.ok) {
      // Remote failure → count error; do not touch cache
      recordError(barcode, r1 - r0);
      return {
        ok: false,
        hit: false,
        status: remote?.status ?? 500,
        record: null,
        error: remote?.error ?? 'remote_error',
        meta: { source: 'remote', latencyMs: r1 - r0 },
      };
    }

    // 3️⃣ Non-destructive merge/save into cache
    //    upsertRemoteEnrichment updates name/price/brand/category + lastFetchedAt
    const merged = await upsertRemoteEnrichment(barcode, remote.data);

    const t2 = now();
    // optionally record the full-round latency as another sample
    recordLatency(t2 - t0);

    return {
      ok: true,
      hit: false,
      status: 200,
      record: merged,
      meta: { source: 'remote', latencyMs: t2 - t0 },
    };
  } catch (e) {
    const te = now();
    recordError(barcode, te - t0);
    // eslint-disable-next-line no-console
    console.error('[cacheFirstLookup] unexpected error:', e);
    return {
      ok: false,
      hit: false,
      status: 500,
      record: null,
      error: e?.message || 'lookup_failed',
      meta: { source: 'exception', latencyMs: te - t0 },
    };
  }
}
