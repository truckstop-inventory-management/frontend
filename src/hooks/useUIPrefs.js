// src/hooks/useUIPrefs.js
import { useEffect, useState } from "react";

const UI_PREFS_KEY = "tsinv:uiPrefs";

export default function useUIPrefs() {
  const [sortBy, setSortBy] = useState("itemName"); // "itemName" | "quantity" | "price"
  const [sortDir, setSortDir] = useState("asc");    // "asc" | "desc"
  const [inStockOnly, setInStockOnly] = useState(false);

  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [lowStockThreshold, setLowStockThreshold] = useState(5);

  // load persisted UI prefs on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(UI_PREFS_KEY);
      if (!raw) return;
      const prefs = JSON.parse(raw);
      if (typeof prefs.showLowStockOnly === "boolean")
        setShowLowStockOnly(prefs.showLowStockOnly);
      if (Number.isFinite(prefs.lowStockThreshold))
        setLowStockThreshold(prefs.lowStockThreshold);
      if (typeof prefs.inStockOnly === "boolean")
        setInStockOnly(prefs.inStockOnly);
      if (typeof prefs.sortBy === "string") setSortBy(prefs.sortBy);
      if (typeof prefs.sortDir === "string") setSortDir(prefs.sortDir);
    } catch (err) {
      console.warn("UI prefs parse error", err);
    }
  }, []);

  // persist UI prefs when relevant values change
  useEffect(() => {
    try {
      const raw = localStorage.getItem(UI_PREFS_KEY);
      const prev = raw ? JSON.parse(raw) : {};
      const merged = {
        ...prev,
        showLowStockOnly,
        lowStockThreshold: Number.isFinite(lowStockThreshold)
          ? lowStockThreshold
          : 5,
        inStockOnly,
        sortBy,
        sortDir,
      };
      localStorage.setItem(UI_PREFS_KEY, JSON.stringify(merged));
    } catch (err) {
      console.warn("UI prefs save error", err);
    }
  }, [showLowStockOnly, lowStockThreshold, inStockOnly, sortBy, sortDir]);

  return {
    sortBy, setSortBy,
    sortDir, setSortDir,
    inStockOnly, setInStockOnly,
    showLowStockOnly, setShowLowStockOnly,
    lowStockThreshold, setLowStockThreshold,
  };
}