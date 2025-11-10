// src/components/MetricsDashboard.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';

// We assume your metrics util lives here per Phase 6 notes.
// Exposed functions: getSnapshot(), reset(), and optionally getSamples()
import * as lookupMetrics from '../utils/lookupMetrics';

function formatMs(val) {
  if (val == null || Number.isNaN(val)) return '—';
  // Round to 1 decimal if < 10ms, to integer otherwise
  return val < 10 ? `${val.toFixed(1)} ms` : `${Math.round(val)} ms`;
}

function Stat({ label, value, subtle }) {
  return (
    <div style={{
      display: 'grid',
      gap: 4,
    }}>
      <div style={{ fontSize: 12, color: subtle ? '#6b7280' : '#9ca3af' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

export default function MetricsDashboard({ pollMs = 5000 }) {
  const [snapshot, setSnapshot] = useState(() => {
    try {
      return lookupMetrics.getSnapshot ? lookupMetrics.getSnapshot() : null;
    } catch {
      return null;
    }
  });
  const [lastUpdated, setLastUpdated] = useState(() => new Date());

  const refresh = useCallback(() => {
    try {
      if (lookupMetrics.getSnapshot) {
        setSnapshot(lookupMetrics.getSnapshot());
        setLastUpdated(new Date());
      }
    } catch {
      // noop — keep previous snapshot
    }
  }, []);

  const reset = useCallback(() => {
    try {
      if (lookupMetrics.reset) {
        lookupMetrics.reset();
        setSnapshot(lookupMetrics.getSnapshot ? lookupMetrics.getSnapshot() : null);
        setLastUpdated(new Date());
      }
    } catch {
      // noop
    }
  }, []);

  useEffect(() => {
    // Auto refresh on interval
    const id = setInterval(refresh, pollMs);
    return () => clearInterval(id);
  }, [pollMs, refresh]);

  // Expose a dev helper while this is in test-only phase
  useEffect(() => {
    // Keep the function stable but referencing latest snapshot via getter
    window.showMetricsDashboard = () => {
      try {
        const snap = lookupMetrics.getSnapshot ? lookupMetrics.getSnapshot() : null;
        if (!snap) {
          // eslint-disable-next-line no-console
          console.warn('[MetricsDashboard] No metrics available yet.');
          return;
        }
        // eslint-disable-next-line no-console
        console.table({
          hits: snap.hits,
          misses: snap.misses,
          errors: snap.errors,
          'p50 latency': snap.latency?.p50,
          'p90 latency': snap.latency?.p90,
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[MetricsDashboard] showMetricsDashboard error:', e);
      }
    };
    return () => {
      if (window.showMetricsDashboard) delete window.showMetricsDashboard;
    };
  }, []);

  const stats = useMemo(() => {
    const s = snapshot || {};
    const counts = {
      hits: s.hits ?? 0,
      misses: s.misses ?? 0,
      errors: s.errors ?? 0,
    };
    const latency = {
      p50: s.latency?.p50 ?? null,
      p90: s.latency?.p90 ?? null,
    };
    return { counts, latency };
  }, [snapshot]);

  // Minimal card styling that won’t conflict with your existing UI
  const cardStyle = {
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 16,
    background: '#fff',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Lookup Metrics</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={refresh} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db' }}>
            Refresh
          </button>
          <button onClick={reset} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db' }}>
            Reset
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        <div style={cardStyle}>
          <Stat label="Hits" value={stats.counts.hits} />
        </div>
        <div style={cardStyle}>
          <Stat label="Misses" value={stats.counts.misses} />
        </div>
        <div style={cardStyle}>
          <Stat label="Errors" value={stats.counts.errors} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        <div style={cardStyle}>
          <Stat label="Latency p50" value={formatMs(stats.latency.p50)} />
        </div>
        <div style={cardStyle}>
          <Stat label="Latency p90" value={formatMs(stats.latency.p90)} />
        </div>
      </div>

      <div style={{ fontSize: 12, color: '#6b7280' }}>
        Last updated: {lastUpdated.toLocaleTimeString()}
        {' • '}
        Auto-refresh: every {Math.round(pollMs / 1000)}s
      </div>
    </div>
  );
}
