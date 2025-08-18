// src/App.jsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { initDB } from "./utils/db";
import { syncWithServer } from "./utils/sync";   // 🔄 sync logic
import { LOCATION } from "./utils/location";

import InventoryViewToggle from "./components/InventoryViewToggle";
import InventoryList from "./components/InventoryList";
import LoginForm from "./components/LoginForm";

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const [token, setToken] = useState(null);
  const [selectedView, setSelectedView] = useState(LOCATION.C_STORE);

  const [metrics, setMetrics] = useState({
    counts: { "C-Store": 0, Restaurant: 0 },
    totals: { "C-Store": 0, Restaurant: 0 },
  });

  const handleMetricsChange = useCallback(({ counts, totals }) => {
    setMetrics({ counts, totals });
  }, []);

  const money = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
      }),
    []
  );

  // On mount: init DB + restore token
  useEffect(() => {
    initDB().then(() => setDbReady(true));
    const savedToken = localStorage.getItem("token");
    if (savedToken) setToken(savedToken);
  }, []);

  // Sync once DB + token ready
  useEffect(() => {
    if (dbReady && token) {
      syncWithServer(token);
    }
  }, [dbReady, token]);

  if (token) {
    const selectedTotal = metrics.totals[selectedView] || 0;

    return (
      <div style={{ paddingTop: 48 }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "0 16px",
            marginBottom: 12,
            gap: 12,
            alignItems: "center",
          }}
        >
          <button
            onClick={() => {
              setToken(null);
              localStorage.removeItem("token");
            }}
          >
            Logout
          </button>

          <InventoryViewToggle
            value={selectedView}
            onChange={setSelectedView}
            counts={metrics.counts}
          />

          <div
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              fontSize: 12,
              border: "1px solid rgba(0,0,0,.1)",
            }}
            title="Total inventory value for current category"
          >
            {money.format(selectedTotal)}
          </div>
        </div>

        {/* Inventory List */}
        <InventoryList
          token={token}
          dbReady={dbReady}
          locationFilter={selectedView}
          onMetricsChange={handleMetricsChange}
        />
      </div>
    );
  }

  return <LoginForm onLogin={setToken} />;
}