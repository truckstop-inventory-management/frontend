// src/components/inventory/TotalsSummary.jsx
import React from "react";

export default function TotalsSummary({ totalsByGroup, totalOverall }) {
  return (
    <div className="mb-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
      <div className="rounded border border-[var(--color-border)] p-3 bg-[var(--color-surface-2)]">
        <div className="text-xs text-[var(--color-muted)]">C-Store Total</div>
        <div className="text-lg font-semibold text-[var(--color-text)]">
          ${totalsByGroup["C-Store"].toFixed(2)}
        </div>
      </div>
      <div className="rounded border border-[var(--color-border)] p-3 bg-[var(--color-surface-2)]">
        <div className="text-xs text-[var(--color-muted)]">Restaurant Total</div>
        <div className="text-lg font-semibold text-[var(--color-text)]">
          ${totalsByGroup["Restaurant"].toFixed(2)}
        </div>
      </div>
      <div className="rounded border border-[var(--color-border)] p-3 bg-[var(--color-surface-2)]">
        <div className="text-xs text-[var(--color-text)]/80">Overall Total</div>
        <div className="text-lg font-bold text-[var(--color-text)]">
          ${totalOverall.toFixed(2)}
        </div>
      </div>
    </div>
  );
}