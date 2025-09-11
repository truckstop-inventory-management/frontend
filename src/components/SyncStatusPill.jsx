// src/components/SyncStatusPill.jsx
import React from "react";

const STATUS_STYLES = {
  synced:
    "bg-[var(--pill-bg-success)] text-[var(--pill-fg-success)] border-[var(--pill-border-success)]",
  syncing:
    "bg-[var(--pill-bg-info)] text-[var(--pill-fg-info)] border-[var(--pill-border-info)]",
  pending:
    "bg-[var(--pill-bg-warning)] text-[var(--pill-fg-warning)] border-[var(--pill-border-warning)]",
  error:
    "bg-[var(--pill-bg-danger)] text-[var(--pill-fg-danger)] border-[var(--pill-border-danger)]",
  unknown:
    "bg-[var(--pill-bg-muted)] text-[var(--pill-fg-muted)] border-[var(--pill-border-muted)]",
};

function normalize(status) {
  const key = String(status || "").toLowerCase();
  if (STATUS_STYLES[key]) return key;
  return "unknown";
}

export default function SyncStatusPill({ status, ariaLabel }) {
  const key = normalize(status);
  const cls = STATUS_STYLES[key] || STATUS_STYLES.unknown;

  return (
    <span
      className={
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap " +
        cls
      }
      aria-label={ariaLabel}
      title={String(status || "unknown")}
    >
      {key === "synced" && (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          className="mr-1"
          aria-hidden="true"
        >
          <path
            d="M20 6L9 17l-5-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {key === "syncing" && (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          className="mr-1 animate-spin"
          aria-hidden="true"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="opacity-25"
          />
          <path
            d="M22 12a10 10 0 0 1-10 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            className="opacity-90"
          />
        </svg>
      )}
      {key === "error" && (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          className="mr-1"
          aria-hidden="true"
        >
          <path
            d="M12 9v4m0 4h.01M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {key.charAt(0).toUpperCase() + key.slice(1)}
    </span>
  );
}
