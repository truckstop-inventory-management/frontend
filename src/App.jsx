// src/App.jsx
import React, { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { initDB, addItem } from "./utils/db";
import { syncWithServer } from "./utils/sync";   // 🔄 sync logic
import { LOCATION } from "./utils/location";

import InventoryViewToggle from "./components/InventoryViewToggle";
import InventoryList from "./components/InventoryList";
import LoginForm from "./components/LoginForm";
import FloatingButton from "./components/FloatingAddButton.jsx";
import { ToastProvider } from "./components/ui/ToastProvider.jsx";
import "./styles/theme.css";

import { setBarcodeCacheDbName, ensureBarcodeCacheInitialized, getCachedBarcode } from "./utils/barcodeCache.js";

// DEV-only remote lookup test helpers
import { fetchRemoteBarcode } from "./utils/fetchRemoteBarcode";
import { mergeAndSaveBarcodeCache } from "./utils/mergeCacheRecords";
// DEV: cache-first helper
import { cacheFirstLookup } from "./utils/cacheFirstLookup";
// DEV: metrics snapshot helpers
import { getSnapshot as getLookupMetricsSnapshot, resetMetrics as resetLookupMetrics } from "./utils/lookupMetrics";

const DevMetricsPanel = React.lazy(() => import('./dev/DevMetricsPanel.jsx'));

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [token, setToken] = useState(null);
  const [selectedView, setSelectedView] = useState(LOCATION.C_STORE);

  const [metrics, setMetrics] = useState({
    counts: { "C-Store": 0, Restaurant: 0 },
    totals: { "C-Store": 0, Restaurant: 0 },
  });

  const handleMetricsChange = useCallback(({ counts, totals }) => {
    setMetrics({ counts, totals });
  }, []);

  // ✅ accept payload from FloatingAddButton and persist *that* item
  const handleAddItem = async (payload) => {
    if (isAdding) return; // 🔒 prevent duplicates on rapid clicks
    setIsAdding(true);

    try {
      // Validate & normalize incoming payload
      const itemName = String(payload?.itemName || "").trim();
      const quantity = Number.isFinite(Number(payload?.quantity)) ? Number(payload.quantity) : 0;
      const price = Number.isFinite(Number(payload?.price)) ? Number(payload.price) : 0;
      const location = String(payload?.location || "C-Store").trim();

      if (!itemName) {
        console.warn("[App] handleAddItem called without a valid itemName; ignoring.");
        return;
      }

      const newItem = {
        itemName,
        quantity,
        price,
        location,
        syncStatus: "pending",
        isDeleted: false,
        lastUpdated: new Date().toISOString(),
      };

      await addItem(newItem);
      console.log("[App] Added new item:", newItem);

      // Optionally trigger sync immediately (preserves your previous behavior)
      await syncWithServer();
    } catch (err) {
      console.error("[App] Error adding item:", err);
    } finally {
      setIsAdding(false);
    }
  };

  const money = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
      }),
    []
  );

  // On mount: **init barcode cache first** to avoid blocked upgrades, then init main DB.
  useEffect(() => {
    (async () => {
      try {
        setBarcodeCacheDbName("truckstop-inventory-db");
        // Ensure the barcodeCache store exists BEFORE other modules open long-lived connections.
        await ensureBarcodeCacheInitialized();

        // Now init your main app DB as usual.
        await initDB();
        setDbReady(true);
        console.log("[App] DB ready");
      } catch (e) {
        console.warn("[App] Startup init encountered an error:", e);
        // We still mark dbReady so the app isn't stuck; barcode cache is non-fatal.
        setDbReady(true);
      }

      // Restore token after DB init
      const existing = localStorage.getItem("token");
      if (existing && existing !== "null") {
        setToken(existing);
      }
    })();
  }, []);

  // Sync when ready + token present
  useEffect(() => {
    if (dbReady && token) {
      syncWithServer(token);
    }
  }, [dbReady, token]);

  // Expose console helper for remote lookup → merge → cache verify (idempotent)
  useEffect(() => {
    window.debugRemoteLookup ||= async (barcode, opts = {}) => {
      try {
        console.log("[DEV] remote fetch start", barcode, opts);
        const res = await fetchRemoteBarcode(barcode, opts);

        if (!res.ok) {
          console.warn("[DEV] remote miss/error", res.status, res.error, res.body);
          return { ok: false, status: res.status, error: res.error, body: res.body };
        }

        const merged = await mergeAndSaveBarcodeCache(barcode, res.data);
        const roundTrip = await getCachedBarcode(barcode);

        console.log("[DEV] merged & saved →", merged);
        console.log("[DEV] cache after save →", roundTrip);

        return { ok: true, merged, cache: roundTrip };
      } catch (e) {
        console.error("[DEV] remote lookup failed", e);
        return { ok: false, status: 0, error: "exception", body: { message: String(e) } };
      }
    };

    console.info(
      "[DEV] window.debugRemoteLookup(barcode, opts) ready — try:",
      "await window.debugRemoteLookup('049000050103')"
    );
  }, []);

  // Expose cache-first coordinator helper
  useEffect(() => {
    window.debugCacheFirstLookup ||= async (barcode, opts = {}) => {
      try {
        const result = await cacheFirstLookup(barcode, opts);
        console.log("[DEV] cache-first result →", result);
        return result;
      } catch (e) {
        console.error("[DEV] cache-first failed", e);
        return { ok: false, hit: false, status: 0, record: null, error: "exception" };
      }
    };

    console.info(
      "[DEV] window.debugCacheFirstLookup(barcode, opts) ready — try:",
      "await window.debugCacheFirstLookup('049000050103')"
    );
  }, []);

  // Expose lookup metrics helpers
  useEffect(() => {
    window.debugLookupMetrics ||= () => {
      const snap = getLookupMetricsSnapshot();
      console.log("[DEV] lookup metrics snapshot →", snap);
      return snap;
    };
    window.resetLookupMetrics ||= () => {
      resetLookupMetrics();
      const snap = getLookupMetricsSnapshot();
      console.log("[DEV] lookup metrics reset →", snap);
      return snap;
    };

    console.info(
      "[DEV] window.debugLookupMetrics() / window.resetLookupMetrics() ready — try:",
      "window.debugLookupMetrics()"
    );
  }, []);

  if (token) {
    const selectedTotal = metrics.totals[selectedView] || 0;

    return (

      <ToastProvider>
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

          <InventoryList
            token={token}
            dbReady={dbReady}
            locationFilter={selectedView}
            onMetricsChange={handleMetricsChange}
          />

          {/* Floating + Button */}
          {/* The FAB now passes a payload; this handler consumes it */}
          <FloatingButton onClick={handleAddItem} />
        </div>

        {/* Dev-only metrics panel (toggle with ?metrics=1 or window.toggleMetricsDashboardUI()) */}
        <Suspense fallback={null}>
          <DevMetricsPanel />
        </Suspense>
      </ToastProvider>
    );
  }

  return (
    <>
      <LoginForm onLogin={setToken} />
      {/* Dev-only metrics panel also available on login screen */}
      <Suspense fallback={null}>
        <DevMetricsPanel />
      </Suspense>
    </>
  );
}
