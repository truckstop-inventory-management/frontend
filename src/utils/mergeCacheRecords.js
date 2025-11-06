// src/utils/mergeCacheRecords.js
//
// Non-destructive merge helpers for combining a local barcodeCache record
// with remote data returned from fetchRemoteBarcode.js.
//
// Design rules:
// - Local user edits WIN for `name` and `price` if present.
// - Remote fills missing metadata like `brand`, `category`, `imageURL`.
// - Always propagate `lastFetchedAt` from remote and mark `source: 'remote'`.
// - Never mutate the input objects; always return a new object.
//
// Exports:
//   mergeCacheRecords(local, remote) -> merged object
//   mergeAndSaveBarcodeCache(barcode, remote) -> merged object (persists into IDB)
//
// Notes:
// - This module depends only on the public helpers in barcodeCache.js.
// - It does NOT create stores or touch DB versions.

import {
  getCachedBarcode,
  updateBarcodeFields,
} from './barcodeCache';

/**
 * Return true if a string is non-empty after trim.
 */
function hasText(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * Return true if a number is finite (0 allowed).
 */
function hasNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Merge local + remote following the non-destructive rules above.
 * @param {Object|null} local - Existing cache entry or null
 * @param {Object|null} remote - Remote payload from fetchRemoteBarcode (ok:true -> .data)
 * @returns {Object} merged record (does not persist)
 */
export function mergeCacheRecords(local, remote) {
  const L = local || {};
  const R = remote || {};

  const merged = {
    // identity
    barcode: L.barcode ?? R.barcode ?? '',

    // prefer local edits for name/price if present
    name: hasText(L.name) ? L.name : (hasText(R.name) ? R.name : ''),

    // allow 0 local price; if local is not a number, use remote if available
    price: hasNumber(L.price) ? L.price : (hasNumber(R.price) ? R.price : undefined),

    // remote fills metadata if provided
    brand: hasText(R.brand) ? R.brand : (hasText(L.brand) ? L.brand : ''),
    category: hasText(R.category) ? R.category : (hasText(L.category) ? L.category : ''),
    imageURL: hasText(R.imageURL) ? R.imageURL : (hasText(L.imageURL) ? L.imageURL : ''),

    // bookkeeping
    seenCount: typeof L.seenCount === 'number' ? L.seenCount : 0,
    lastSeenAt: L.lastSeenAt || '',

    // provenance + freshness
    source: 'remote',
    lastFetchedAt: R.lastFetchedAt || new Date().toISOString(),
  };

  return merged;
}

/**
 * Compute a minimal patch object (shallow) between base -> next.
 */
function diffPatch(base, next) {
  const out = {};
  for (const k of Object.keys(next)) {
    if (next[k] !== base[k]) out[k] = next[k];
  }
  return out;
}

/**
 * Merge remote payload into the existing cache entry and persist the delta.
 * Uses updateBarcodeFields() so it only patches changed fields.
 *
 * @param {string} barcode
 * @param {Object} remoteData - typically res.data from fetchRemoteBarcode()
 * @returns {Promise<Object>} merged record after persistence
 */
export async function mergeAndSaveBarcodeCache(barcode, remoteData) {
  const local = await getCachedBarcode(barcode);
  const merged = mergeCacheRecords(local, remoteData);

  // Build a minimal patch (excluding `barcode`)
  const { barcode: _b, ...patch } = merged;
  const base = local || {};
  const delta = diffPatch(base, patch);

  // If nothing changed, return merged as-is.
  const keys = Object.keys(delta);
  if (keys.length === 0) return merged;

  const saved = await updateBarcodeFields(merged.barcode, delta);
  return saved;
}
