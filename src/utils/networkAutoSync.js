// src/utils/networkAutoSync.js
// Optional helper to auto-sync on reconnect via @capacitor/network if present.
import { runFullSync } from "./sync";

let _started = false;

export async function registerNetworkAutoSync() {
  if (_started) return;
  _started = true;

  try {
    const mod = await import(/* @vite-ignore */ "@capacitor/network");
    const { Network } = mod || {};
    if (!Network) return;

    const status = await Network.getStatus().catch(() => null);
    if (status?.connected) {
      // no-op on start; only react to *changes*
    }

    await Network.addListener("networkStatusChange", (s) => {
      if (s?.connected) {
        // fire-and-forget; UI already shows spinner/pill
        try { runFullSync(); } catch (e) { console.warn("[AutoSync] failed:", e); }
      }
    });
  } catch {
    // Safe no-op if Capacitor network isn’t installed at runtime
  }
}
