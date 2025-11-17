// src/utils/metricsUploader.js

// -----------------------------------------------------------------------------
// Phase 7 scaffold: client-side batching adapter for metrics uploads.
// -----------------------------------------------------------------------------

const QUEUE = [];
let flushing = false;
let lastFlushError = null;

/** Enqueue events for later upload */
export function postMetrics(eventOrEvents) {
  if (!eventOrEvents) return;

  const now = Date.now();
  const list = Array.isArray(eventOrEvents) ? eventOrEvents : [eventOrEvents];

  for (const raw of list) {
    if (!raw) continue;
    const { type, barcode, latencyMs, timestamp } = raw;

    QUEUE.push({
      type: typeof type === 'string' ? type : 'unknown',
      barcode: barcode || null,
      latencyMs: typeof latencyMs === 'number' ? latencyMs : null,
      timestamp: typeof timestamp === 'number' ? timestamp : now,
    });
  }
}

export function getPendingMetrics() {
  return QUEUE.slice();
}

export function getPendingCount() {
  return QUEUE.length;
}

export function getLastFlushError() {
  return lastFlushError;
}

export function clearQueue() {
  QUEUE.length = 0;
  lastFlushError = null;
}

/**
 * Upload queued metrics to server.
 */
export async function flushQueuedMetrics(options = {}) {
  const endpoint = options.endpoint || '/api/metrics/lookup';

  if (!QUEUE.length) return { ok: true, sent: 0 };
  if (flushing) return { ok: true, sent: 0, skipped: QUEUE.length };

  flushing = true;
  lastFlushError = null;

  const payload = {
    exportedAt: new Date().toISOString(),
    items: QUEUE.slice(),
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.status);
      throw new Error(`HTTP ${res.status}: ${text}`);
    }

    const sent = QUEUE.length;
    QUEUE.length = 0;
    flushing = false;
    return { ok: true, sent };
  } catch (err) {
    lastFlushError = err;
    flushing = false;

    // DEV-only console warning
    if (import.meta && import.meta.env && import.meta.env.DEV) {
      console.warn('[metricsUploader] flush failed, queue retained:', err);
    }

    return { ok: false, error: err };
  }
}

// DEV helpers
if (typeof window !== 'undefined' && import.meta && import.meta.env && import.meta.env.DEV) {
  window.debugMetricsUploader = {
    postMetrics,
    getPendingMetrics,
    getPendingCount,
    flushQueuedMetrics,
    clearQueue,
    getLastFlushError,
  };

  console.info('[metricsUploader] dev helpers attached → window.debugMetricsUploader');
}
