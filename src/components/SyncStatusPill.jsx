// src/components/SyncStatusPill.jsx
import React from "react";

const STYLES = {
  base: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "9999px",
    fontSize: "12px",
    lineHeight: "16px",
    fontWeight: 600,
    border: "1px solid transparent",
  },
  synced: { background: "#ECFDF5", color: "#065F46", borderColor: "#A7F3D0" },   // green
  pending: { background: "#FFFBEB", color: "#92400E", borderColor: "#FDE68A" },  // yellow
  conflict:{ background: "#FEF2F2", color: "#991B1B", borderColor: "#FECACA" },  // red
  unknown: { background: "#F3F4F6", color: "#374151", borderColor: "#E5E7EB" },  // gray
};

export default function SyncStatusPill({ status }) {
  const s = String(status || "").toLowerCase();
  const style =
    s === "synced" ? STYLES.synced :
    s === "pending" ? STYLES.pending :
    s === "conflict" ? STYLES.conflict :
    STYLES.unknown;

  return (
    <span style={{ ...STYLES.base, ...style }}>
      {s || "unknown"}
    </span>
  );
}