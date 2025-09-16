// src/hooks/useSyncSpinner.js
import { useEffect, useState } from "react";
import { syncBus } from "../utils/sync.js";

export default function useSyncSpinner() {
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const onStart = () => setIsSyncing(true);
    const onEnd = () => setIsSyncing(false);
    try {
      syncBus.addEventListener("syncstart", onStart);
      syncBus.addEventListener("syncend", onEnd);
    } catch (_) {}
    return () => {
      try {
        syncBus.removeEventListener("syncstart", onStart);
        syncBus.removeEventListener("syncend", onEnd);
      } catch (_) {}
    };
  }, []);

  return isSyncing;
}