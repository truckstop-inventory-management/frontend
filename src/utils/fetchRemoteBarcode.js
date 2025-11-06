// src/utils/fetchRemoteBarcode.js
//
// Mock remote lookup for `/api/products/:barcode` used to enrich local cache.
// No network requests — this simulates latency and error cases deterministically.
//
// Usage:
//   import { fetchRemoteBarcode } from './fetchRemoteBarcode'
//   const res = await fetchRemoteBarcode('049000050103')
//   if (res.ok) { /* res.data */ } else { /* res.status, res.error */ }

const DEFAULT_MIN_LATENCY_MS = 150;
const DEFAULT_MAX_LATENCY_MS = 450;

/** Small, editable in-memory catalog for local testing (MUTABLE for test overrides) */
export const REMOTE_MOCK_DB = {
  // Gatorade Lemon-Lime 20oz
  '049000050103': {
    barcode: '049000050103',
    name: 'Gatorade Thirst Quencher Lemon-Lime 20oz',
    price: 2.29,
    brand: 'Gatorade',
    category: 'Beverages',
    imageURL: 'https://cdn.example.com/p/049000050103.jpg',
  },

  // Coke 12oz (example)
  '049000042657': {
    barcode: '049000042657',
    name: 'Coca-Cola 12oz',
    price: 1.49,
    brand: 'Coca-Cola',
    category: 'Beverages',
    imageURL: 'https://cdn.example.com/p/049000042657.jpg',
  },

  // Chips (example)
  '028400642040': {
    barcode: '028400642040',
    name: 'Lay’s Classic Potato Chips 2.5oz',
    price: 1.99,
    brand: 'Lay’s',
    category: 'Snacks',
    imageURL: 'https://cdn.example.com/p/028400642040.jpg',
  },
};

/** Simulate network latency. */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Pick a random integer between min and max (inclusive). */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Normalize a barcode to string. */
function normalizeBarcode(b) {
  if (b == null) return '';
  return String(b).trim(); // keep leading zeros; do not strip non-digits
}

/** Build a success payload matching our remote schema. */
function buildSuccessPayload(record) {
  const now = new Date().toISOString();
  return {
    ...record,
    lastFetchedAt: now,
    source: 'remote',
  };
}

/** Build a standard error payload for non-200 responses. */
function buildErrorPayload(code, message) {
  const now = new Date().toISOString();
  const error =
    code === 404
      ? 'not_found'
      : code === 429
        ? 'rate_limited'
        : code >= 500
          ? 'server_error'
          : 'unknown';
  return {
    error,
    message,
    lastFetchedAt: now,
  };
}

/**
 * Fetch a product by barcode from the mock "remote" service.
 *
 * @param {string} barcode - The product barcode to look up.
 * @param {Object} opts
 * @param {number} [opts.minLatencyMs=150] - Min simulated latency.
 * @param {number} [opts.maxLatencyMs=450] - Max simulated latency.
 * @param {'none'|'404'|'429'|'500'} [opts.forceError='none'] - Force a specific error outcome.
 * @returns {Promise<{ok:true,status:200,data:Object} | {ok:false,status:number,error:string,body:Object}>}
 */
export async function fetchRemoteBarcode(
  barcode,
  {
    minLatencyMs = DEFAULT_MIN_LATENCY_MS,
    maxLatencyMs = DEFAULT_MAX_LATENCY_MS,
    forceError = 'none',
  } = {}
) {
  const code = normalizeBarcode(barcode);

  // Basic input validation
  if (!code) {
    return {
      ok: false,
      status: 400,
      error: 'bad_request',
      body: buildErrorPayload(400, 'Barcode is required'),
    };
  }

  // Simulate variable network latency
  const ms =
    minLatencyMs === maxLatencyMs
      ? minLatencyMs
      : randomInt(
        Math.min(minLatencyMs, maxLatencyMs),
        Math.max(minLatencyMs, maxLatencyMs)
      );
  await delay(ms);

  // Forced error path for testing retry/metrics flows
  if (forceError === '404') {
    return {
      ok: false,
      status: 404,
      error: 'not_found',
      body: buildErrorPayload(404, `No product found for barcode ${code}`),
    };
  }
  if (forceError === '429') {
    return {
      ok: false,
      status: 429,
      error: 'rate_limited',
      body: buildErrorPayload(429, 'Too many requests; retry later'),
    };
  }
  if (forceError === '500') {
    return {
      ok: false,
      status: 500,
      error: 'server_error',
      body: buildErrorPayload(500, 'Internal server error'),
    };
  }

  // Normal lookup path
  const record = REMOTE_MOCK_DB[code];
  if (!record) {
    return {
      ok: false,
      status: 404,
      error: 'not_found',
      body: buildErrorPayload(404, `No product found for barcode ${code}`),
    };
  }

  const data = buildSuccessPayload(record);
  return { ok: true, status: 200, data };
}

/**
 * Test helper: override or insert a mock record at runtime.
 * Useful in console or unit tests.
 */
export function __setMockResponse(barcode, record) {
  const code = normalizeBarcode(barcode);
  if (!code || !record || typeof record !== 'object') return false;
  REMOTE_MOCK_DB[code] = { ...record, barcode: code };
  return true;
}
