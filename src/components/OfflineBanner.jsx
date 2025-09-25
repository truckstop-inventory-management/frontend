import React, { useEffect, useState } from 'react';
import useOnlineStatus from '../hooks/useOnlineStatus';
import { runFullSync } from '../utils/sync';

export default function OfflineBanner({ token }) {
  const { isOnline, changedAt } = useOnlineStatus();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setVisible(true);
      return;
    }
    setVisible(true);
    if (token) {
      console.log("🌐 Back online — starting sync…");
      runFullSync(token);
    }
    const t = setTimeout(() => setVisible(false), 2500);
    return () => clearTimeout(t);
  }, [isOnline, changedAt, token]);

  if (!visible) return null;

  const baseStyle = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    padding: "10px 14px",
    fontSize: 14,
    textAlign: "center",
    color: "#fff",
    zIndex: 9999,
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
  };

  const bannerStyle = isOnline
    ? { ...baseStyle, background: "#16a34a" } // green
    : { ...baseStyle, background: "#ef4444" }; // red

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        ...bannerStyle,
        // keep it clear of notches/camera holes
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)",
      }}
    >
      {isOnline
        ? "Back online — syncing…"
        : "Offline mode — changes will sync when you reconnect"}
    </div>
  );
}
