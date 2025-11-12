// src/components/MetricsDashboard.jsx
import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
  forwardRef,
} from 'react';
import * as lookupMetrics from '../utils/lookupMetrics';
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

function formatMs(val) {
  if (val == null || Number.isNaN(val)) return '—';
  return val < 10 ? `${val.toFixed(1)} ms` : `${Math.round(val)} ms`;
}

function Stat({ label, value, subtle }) {
  return (
    <div className="grid gap-1">
      <div className={`text-xs ${subtle ? 'text-gray-500' : 'text-gray-400'}`}>{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}

// Properly forward ref so our chart mount observer works reliably
const Card = forwardRef(function Card({ children, className = '' }, ref) {
  return (
    <div ref={ref} className={`rounded-2xl border border-gray-200 bg-white shadow-sm p-4 ${className}`}>
      {children}
    </div>
  );
});

export default function MetricsDashboard({ pollMs = 5000, maxPoints = 20 }) {
  const [snapshot, setSnapshot] = useState(() => {
    try { return lookupMetrics.getSnapshot ? lookupMetrics.getSnapshot() : null; } catch { return null; }
  });
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const [trend, setTrend] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // New: pause + interval control (pulling some polish from tomorrow’s plan)
  const [paused, setPaused] = useState(false);
  const [intervalMs, setIntervalMs] = useState(pollMs);

  // Chart mount safety
  const [chartReady, setChartReady] = useState(false);
  const chartRef = useRef(null);
  useEffect(() => {
    if (!chartRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect || {};
        if ((width ?? 0) > 0 && (height ?? 0) > 0) setChartReady(true);
      }
    });
    ro.observe(chartRef.current);
    return () => ro.disconnect();
  }, []);

  const refresh = useCallback(() => {
    try {
      if (!lookupMetrics.getSnapshot) return;
      const snap = lookupMetrics.getSnapshot();
      setSnapshot(snap);
      setLastUpdated(new Date());

      const p50 = snap?.latency?.p50;
      const p90 = snap?.latency?.p90;

      if (typeof p50 === 'number' || typeof p90 === 'number') {
        const nowTs = Date.now();
        setTrend(prev => {
          const last = prev[prev.length - 1];
          const tooSoon = last ? (nowTs - last.t) < Math.max(0, intervalMs - 100) : false;
          const sameValues = last ? (last.p50 === p50 && last.p90 === p90) : false;
          if (last && tooSoon && sameValues) return prev;
          const next = [...prev, { t: nowTs, p50, p90 }];
          return next.slice(-maxPoints);
        });
      }
    } catch {
      // noop
    }
  }, [intervalMs, maxPoints]);

  const reset = useCallback(() => {
    try {
      if (lookupMetrics.reset) lookupMetrics.reset();
      else if (lookupMetrics.resetMetrics) lookupMetrics.resetMetrics();
      const snap = lookupMetrics.getSnapshot ? lookupMetrics.getSnapshot() : null;
      setSnapshot(snap);
      setTrend([]);
      setLastUpdated(new Date());
    } catch {}
  }, []);

  // Interval timer (respects pause + user-chosen interval)
  useEffect(() => {
    if (paused) return;
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [paused, intervalMs, refresh]);

  // Dev helpers + keyboard shortcuts
  useEffect(() => {
    window.showMetricsDashboard = () => {
      try {
        const snap = lookupMetrics.getSnapshot ? lookupMetrics.getSnapshot() : null;
        if (!snap) return console.warn('[MetricsDashboard] No metrics available yet.');
        console.table({
          hits: snap.hits, misses: snap.misses, errors: snap.errors,
          'p50 latency': snap.latency?.p50, 'p90 latency': snap.latency?.p90,
        });
      } catch (e) { console.error('[MetricsDashboard] showMetricsDashboard error:', e); }
    };
    window.debugLookupSamples = () => trend.map(d => ({ t: d.t, p50: d.p50, p90: d.p90 }));

    const onKey = (e) => {
      // Ignore if typing
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;
      if (e.key === 'r' || e.key === 'R') refresh();
      if (e.key === 'x' || e.key === 'X') reset();
      if (e.key === 'v' || e.key === 'V') setShowAdvanced(v => !v);
      if (e.key === 'p' || e.key === 'P') setPaused(p => !p);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      delete window.showMetricsDashboard;
      delete window.debugLookupSamples;
      window.removeEventListener('keydown', onKey);
    };
  }, [refresh, reset, trend]);

  const stats = useMemo(() => {
    const s = snapshot || {};
    return {
      counts: { hits: s.hits ?? 0, misses: s.misses ?? 0, errors: s.errors ?? 0 },
      latency: { p50: s.latency?.p50 ?? null, p90: s.latency?.p90 ?? null },
    };
  }, [snapshot]);

  const perBarcode = useMemo(() => {
    try {
      if (typeof lookupMetrics.getPerBarcodeStats === 'function') {
        const rows = lookupMetrics.getPerBarcodeStats() || [];
        return rows.slice().sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0));
      }
    } catch {}
    return null;
  }, [snapshot]);

  const hasTrend = trend.length >= 3;

  // Export JSON (snapshot + table + samples)
  const exportJson = useCallback(() => {
    try {
      const data = {
        exportedAt: new Date().toISOString(),
        snapshot: lookupMetrics.getSnapshot ? lookupMetrics.getSnapshot() : null,
        perBarcode: typeof lookupMetrics.getPerBarcodeStats === 'function' ? lookupMetrics.getPerBarcodeStats() : [],
        samples: typeof lookupMetrics.getSamples === 'function' ? lookupMetrics.getSamples() : [],
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lookup-metrics-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('[MetricsDashboard] exportJson failed:', e);
    }
  }, []);

  return (
    <div className="grid gap-4 px-3 pb-[env(safe-area-inset-bottom)]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-lg font-bold">Lookup Metrics</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={refresh}
            className="rounded-xl border border-gray-300 px-3 py-1.5 text-sm"
            title="Fetch the latest metrics snapshot (R)"
            aria-label="Refresh metrics"
          >
            Refresh
          </button>
          <button
            onClick={reset}
            className="rounded-xl border border-gray-300 px-3 py-1.5 text-sm"
            title="Clear counters and latency samples (X)"
            aria-label="Reset metrics"
          >
            Reset
          </button>
          <button
            onClick={() => setShowAdvanced(v => !v)}
            aria-expanded={showAdvanced}
            className="rounded-xl border border-gray-300 px-3 py-1.5 text-sm"
            title={showAdvanced ? 'Hide per-barcode statistics (V)' : 'Show per-barcode statistics (V)'}
            aria-label={showAdvanced ? 'Hide per-barcode stats' : 'View per-barcode stats'}
          >
            {showAdvanced ? 'Hide Per-Barcode Stats' : 'View Per-Barcode Stats'}
          </button>

          {/* Pause / resume + interval selector */}
          <button
            onClick={() => setPaused(p => !p)}
            className="rounded-xl border border-gray-300 px-3 py-1.5 text-sm"
            title="Pause or resume auto-refresh (P)"
            aria-pressed={paused}
          >
            {paused ? 'Resume Auto-Refresh' : 'Pause Auto-Refresh'}
          </button>
          <select
            className="rounded-xl border border-gray-300 px-2 py-1.5 text-sm"
            value={intervalMs}
            onChange={(e) => setIntervalMs(Number(e.target.value))}
            title="Auto-refresh interval"
            aria-label="Auto-refresh interval"
          >
            <option value={2000}>2s</option>
            <option value={5000}>5s</option>
            <option value={10000}>10s</option>
          </select>

          {/* Export JSON */}
          <button
            onClick={exportJson}
            className="rounded-xl border border-gray-300 px-3 py-1.5 text-sm"
            title="Export snapshot, per-barcode stats, and latency samples"
            aria-label="Export metrics as JSON"
          >
            Export JSON
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card><Stat label="Hits" value={stats.counts.hits} /></Card>
        <Card><Stat label="Misses" value={stats.counts.misses} /></Card>
        <Card><Stat label="Errors" value={stats.counts.errors} /></Card>
      </div>

      {/* Divider */}
      <div className="mx-1 border-t border-gray-200" role="separator" aria-hidden="true" />

      {/* Current latency snapshot */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card><Stat label="Latency p50" value={formatMs(stats.latency.p50)} /></Card>
        <Card><Stat label="Latency p90" value={formatMs(stats.latency.p90)} /></Card>
      </div>

      {/* Trend card */}
      <Card ref={chartRef}>
        <div className="flex items-baseline justify-between">
          <div className="font-semibold">Latency Trend (last {Math.min(trend.length, maxPoints)} pts)</div>
          <div className="text-xs text-gray-500" title="Updated automatically at the chosen interval">
            p50 &amp; p90 · auto-refresh {Math.round(intervalMs / 1000)}s
          </div>
        </div>

        {hasTrend && chartReady ? (
          <div className="mt-2 h-44 w-full">
            <ResponsiveContainer>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="t"
                  minTickGap={24}
                  tickFormatter={(t) => {
                    const d = new Date(t);
                    return `${d.getMinutes()}:${String(d.getSeconds()).padStart(2, '0')}`;
                  }}
                />
                <YAxis domain={['auto', 'auto']} tickFormatter={(v) => `${Math.round(v)} ms`} />
                <Tooltip
                  labelFormatter={(t) => new Date(t).toLocaleTimeString()}
                  formatter={(v, n) => [`${Math.round(v)} ms`, n]}
                />
                <Line type="monotone" dataKey="p50" dot={false} isAnimationActive={false} name="p50" />
                <Line type="monotone" dataKey="p90" dot={false} isAnimationActive={false} name="p90" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : !hasTrend ? (
          <div className="mt-4 flex flex-col items-center justify-center py-6 text-xs text-gray-500 animate-pulse">
            <svg className="mb-2 h-6 w-6 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <circle cx="12" cy="12" r="10" strokeWidth="2" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6l3 3" />
            </svg>
            <span>Collecting lookup samples…</span>
          </div>
        ) : (
          <div className="mt-4 text-xs text-gray-500">Loading chart…</div>
        )}
      </Card>

      {/* Advanced details */}
      {showAdvanced && (
        <Card>
          <div className="flex items-baseline justify-between">
            <div className="font-semibold">Per-Barcode Statistics</div>
            <div className="text-xs text-gray-500">Hits · Misses · Errors · Last seen</div>
          </div>

          {Array.isArray(perBarcode) ? (
            perBarcode.length ? (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                  <tr className="text-left text-gray-500">
                    <th className="px-2 py-1.5">Barcode</th>
                    <th className="px-2 py-1.5">Hits</th>
                    <th className="px-2 py-1.5">Misses</th>
                    <th className="px-2 py-1.5">Errors</th>
                    <th className="px-2 py-1.5">Last Seen</th>
                    <th className="px-2 py-1.5">Actions</th>
                  </tr>
                  </thead>
                  <tbody>
                  {perBarcode.map((r, i) => (
                    <tr key={`${r.barcode}-${i}`} className="border-t border-gray-200">
                      <td className="px-2 py-1.5 font-mono">{r.barcode || '—'}</td>
                      <td className="px-2 py-1.5">{r.hits ?? 0}</td>
                      <td className="px-2 py-1.5">{r.misses ?? 0}</td>
                      <td className="px-2 py-1.5">{r.errors ?? 0}</td>
                      <td className="px-2 py-1.5">
                        {r.lastSeenAt ? new Date(r.lastSeenAt).toLocaleString() : '—'}
                      </td>
                      <td className="px-2 py-1.5">
                        <button
                          className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                          title="Re-run cache-first lookup for this barcode (dev)"
                          onClick={() => {
                            try {
                              if (typeof window.debugCacheFirstLookup === 'function' && r.barcode) {
                                window.debugCacheFirstLookup(r.barcode);
                              }
                            } catch {}
                          }}
                        >
                          Re-run
                        </button>
                      </td>
                    </tr>
                  ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-2 text-xs text-gray-500">No per-barcode data yet — perform a few lookups.</div>
            )
          ) : (
            <div className="mt-2 text-xs text-gray-500">
              Per-barcode view not available. If desired, expose <code>getPerBarcodeStats()</code> in <code>lookupMetrics.js</code>.
            </div>
          )}
        </Card>
      )}

      <div className="text-xs text-gray-500">
        Last updated: {lastUpdated.toLocaleTimeString()} • Auto-refresh: {paused ? 'paused' : `${Math.round(intervalMs / 1000)}s`}
      </div>
    </div>
  );
}
