// src/utils/metricsUploader.js

// -----------------------------------------------------------------------------
// Phase 7 scaffold: client-side batching adapter for metrics uploads.
// -----------------------------------------------------------------------------

const QUEUE = [];
let flushing = false;
let lastFlushError = null;

// Phase 7 upload state tracking (for UI)
let autoUploadEnabled = false;
let autoUploadTimerId = null;
let lastUploadAt = null;
let lastUploadOk = null;

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

export function getPendingMetricsCount() {
  return getPendingCount();
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

    lastUploadAt = Date.now();
    lastUploadOk = true;

    return { ok: true, sent };
  } catch (err) {
    lastFlushError = err;
    flushing = false;

    lastUploadAt = Date.now();
    lastUploadOk = false;

    // DEV-only console warning
    if (import.meta && import.meta.env && import.meta.env.DEV) {
      console.warn('[metricsUploader] flush failed, queue retained:', err);
    }

    return { ok: false, error: err };
  }
}

/**
 * Convenience alias used by the dashboard. Keeps semantics identical to flushQueuedMetrics.
 */
export async function flushMetrics(options = {}) {
  return flushQueuedMetrics(options);
}

/**
 * Expose upload state for the Phase 7 dashboard.
 */
export function getMetricsUploadState() {
  return {
    isUploading: flushing,
    lastUploadAt,
    lastUploadOk,
    lastUploadError: lastFlushError,
    autoUploadEnabled,
    pendingCount: getPendingCount(),
  };
}

function ensureAutoUploadTimer() {
  if (!autoUploadEnabled) return;
  if (autoUploadTimerId != null) return;

  autoUploadTimerId = setInterval(() => {
    if (!autoUploadEnabled) return;
    if (!QUEUE.length) return;

    // fire-and-forget; errors are captured in lastFlushError
    flushQueuedMetrics().catch(() => {});
  }, 5000);
}

function clearAutoUploadTimer() {
  if (autoUploadTimerId != null) {
    clearInterval(autoUploadTimerId);
    autoUploadTimerId = null;
  }
}

/**
 * Enable or disable auto-upload of queued metrics.
 */
export function setAutoUploadEnabled(enabled) {
  autoUploadEnabled = Boolean(enabled);
  if (autoUploadEnabled) {
    ensureAutoUploadTimer();
  } else {
    clearAutoUploadTimer();
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
