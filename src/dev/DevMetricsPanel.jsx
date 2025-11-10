import React, { Suspense, useEffect, useMemo, useState } from 'react';

const MetricsDashboard = React.lazy(() =>
  import('../components/MetricsDashboard.jsx')
);

export default function DevMetricsPanel() {
  const [visible, setVisible] = useState(() => {
    const hasParam = typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('metrics') === '1';
    return !!hasParam;
  });

  useEffect(() => {
    // Global toggle for quick access in DevTools
    window.toggleMetricsDashboardUI = () => setVisible(v => !v);
    return () => { delete window.toggleMetricsDashboardUI; };
  }, []);

  if (!visible) return null;

  // Simple floating panel, low z-index so it won’t block modals
  return (
    <div style={{
      position: 'fixed',
      right: 12,
      bottom: 12,
      width: 380,
      maxWidth: '90vw',
      maxHeight: '70vh',
      overflow: 'auto',
      background: '#ffffff',
      border: '1px solid #e5e7eb',
      borderRadius: 12,
      padding: 12,
      boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
      zIndex: 20,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <strong>Metrics (Dev)</strong>
        <button
          onClick={() => setVisible(false)}
          style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12 }}
        >
          Close
        </button>
      </div>
      <Suspense fallback={<div style={{ fontSize: 12, color: '#6b7280' }}>Loading metrics…</div>}>
        <MetricsDashboard pollMs={5000} />
      </Suspense>
    </div>
  );
}
