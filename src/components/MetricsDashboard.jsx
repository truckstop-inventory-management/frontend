// src/components/MetricsDashboard.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import * as lookupMetrics from '../utils/lookupMetrics';
import {
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
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

export default function MetricsDashboard({ pollMs = 5000, maxPoints = 20 }) {
  const [snapshot, setSnapshot] = useState(() => {
    try { return lookupMetrics.getSnapshot ? lookupMetrics.getSnapshot() : null; } catch { return null; }
  });
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const [trend, setTrend] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const refresh = useCallback(() => {
    try {
      if (lookupMetrics.getSnapshot) {
        const snap = lookupMetrics.getSnapshot();
        setSnapshot(snap);
        setLastUpdated(new Date());

        const p50 = snap?.latency?.p50;
        const p90 = snap?.latency?.p90;
        if (typeof p50 === 'number' || typeof p90 === 'number') {
          setTrend(prev => [...prev, { t: Date.now(), p50, p90 }].slice(-maxPoints));
        }
      }
    } catch {}
  }, [maxPoints]);

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

  useEffect(() => {
    const id = setInterval(refresh, pollMs);
    return () => clearInterval(id);
  }, [pollMs, refresh]);

  // dev helpers
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
    return () => { delete window.showMetricsDashboard; delete window.debugLookupSamples; };
  }, [trend]);

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

  const Card = ({ children, className = '' }) => (
    <div className={`rounded-2xl border border-gray-200 bg-white shadow-sm p-4 ${className}`}>
      {children}
    </div>
  );

  return (
    <div className="grid gap-4 px-3 pb-[env(safe-area-inset-bottom)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="m-0 text-lg font-bold">Lookup Metrics</h2>
        <div className="flex gap-2">
          <button onClick={refresh} className="rounded-xl border border-gray-300 px-3 py-1.5 text-sm">
            Refresh
          </button>
          <button onClick={reset} className="rounded-xl border border-gray-300 px-3 py-1.5 text-sm">
            Reset
          </button>
          <button
            onClick={() => setShowAdvanced(v => !v)}
            aria-expanded={showAdvanced}
            className="rounded-xl border border-gray-300 px-3 py-1.5 text-sm"
            title="Show advanced details"
          >
            {showAdvanced ? 'Hide Details' : 'Show Details'}
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card><Stat label="Hits" value={stats.counts.hits} /></Card>
        <Card><Stat label="Misses" value={stats.counts.misses} /></Card>
        <Card><Stat label="Errors" value={stats.counts.errors} /></Card>
      </div>

      {/* Current latency snapshot */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card><Stat label="Latency p50" value={formatMs(stats.latency.p50)} /></Card>
        <Card><Stat label="Latency p90" value={formatMs(stats.latency.p90)} /></Card>
      </div>

      {/* Trend card */}
      <Card>
        <div className="flex items-baseline justify-between">
          <div className="font-semibold">
            Latency Trend (last {Math.min(trend.length, maxPoints)} pts)
          </div>
          <div className="text-xs text-gray-500">
            p50 & p90; auto-refresh {Math.round(pollMs / 1000)}s
          </div>
        </div>

        {hasTrend ? (
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
        ) : (
          <div className="mt-2 text-xs text-gray-500">
            Insufficient data — run a few lookups to populate the trend.
          </div>
        )}
      </Card>

      {/* Advanced details (collapsible) */}
      {showAdvanced && (
        <Card>
          <div className="flex items-baseline justify-between">
            <div className="font-semibold">Advanced Details</div>
            <div className="text-xs text-gray-500">Per-barcode snapshot</div>
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
        Last updated: {lastUpdated.toLocaleTimeString()} • Auto-refresh: every {Math.round(pollMs / 1000)}s
      </div>
    </div>
  );
}
