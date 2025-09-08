// src/components/SyncStatusPill.jsx

import React, { useEffect, useRef, useState } from "react";

/**
 * Displays a small colored pill for sync status.
 * - Uses theme.css tokens (var(--color-success|warning|danger|muted))
 * - Accessible: keyboard focusable, ARIA label, tooltip on hover/focus/tap
 *
 * Props:
 *   - status: "synced" | "pending" | "conflict" | string
 *   - ariaLabel?: optional custom label for screen readers
 */
const SyncStatusPill = ({ status, ariaLabel }) => {
  const normalized = String(status || "").toLowerCase();

  const config = (() => {
    switch (normalized) {
      case "synced":
        return {
          label: "synced",
          sr: "Synced with server",
          bgVar: "var(--color-success)",
          legend: "Saved on server",
        };
      case "pending":
        return {
          label: "pending",
          sr: "Pending sync",
          bgVar: "var(--color-warning)",
          legend: "Waiting to sync",
        };
      case "conflict":
        return {
          label: "conflict",
          sr: "Conflict. Needs attention",
          bgVar: "var(--color-danger)",
          legend: "Needs attention (version conflict)",
        };
      default:
        return {
          label: normalized || "unknown",
          sr: "Unknown sync status",
          bgVar: "var(--color-muted)",
          legend: "Status unknown",
        };
    }
  })();

  // Tooltip visibility (for touch + keyboard focus)
  const [showLegend, setShowLegend] = useState(false);
  const hideTimer = useRef(null);

  const openLegend = () => {
    setShowLegend(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowLegend(false), 2000);
  };

  const closeLegend = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setShowLegend(false);
  };

  useEffect(() => () => hideTimer.current && clearTimeout(hideTimer.current), []);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openLegend();
    }
  };

  const a11yLabel = ariaLabel || config.sr;

  return (
    <span className="relative inline-flex items-center justify-center group">
      {/* Pill (focusable for keyboard; announces via aria-label) */}
      <span
        role="status"
        aria-label={a11yLabel}
        tabIndex={0}
        onFocus={openLegend}
        onBlur={closeLegend}
        onMouseEnter={() => setShowLegend(true)}
        onMouseLeave={closeLegend}
        onTouchStart={(e) => {
          if (e.cancelable) e.preventDefault();
          openLegend();
        }}
        onKeyDown={handleKeyDown}
        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white focus-ring cursor-default"
        style={{ backgroundColor: config.bgVar }}
      >
        {config.label}
      </span>

      {/* Legend (tooltip) */}
      <span
        className={`pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-1 text-[10px] leading-none
                    border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]
                    shadow transition-opacity duration-150
                    ${showLegend ? "opacity-100" : "opacity-0"}
                    group-hover:opacity-100 group-focus:opacity-100`}
        role="tooltip"
      >
        {config.legend}
      </span>
    </span>
  );
};

export default SyncStatusPill;
