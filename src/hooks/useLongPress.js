// src/hooks/useLongPress.js
import { useCallback, useEffect, useRef, useState } from "react";

export default function useLongPress(
  onLongPress,
  {
    threshold = 600,
    onStart,
    onCancel,
    onFinish,
    suppressContextMenu = true,
  } = {}
) {
  const timerRef = useRef(null);
  const firedRef = useRef(false);
  const activeRef = useRef(false); // tracks whether a press is currently active
  const targetRef = useRef(null); // last event target (for contextmenu suppression)
  const [isPressing, setIsPressing] = useState(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopPress = useCallback(
    (wasCanceled = false) => {
      if (!activeRef.current) return;
      activeRef.current = false;
      setIsPressing(false);
      clearTimer();

      if (!firedRef.current && wasCanceled) {
        // Press ended before threshold
        onCancel && onCancel();
      }
      // Reset "fired" after each interaction
      firedRef.current = false;
    },
    [clearTimer, onCancel]
  );

  const startPress = useCallback(
    (ev) => {
      // record last target to optionally suppress context menu
      targetRef.current = ev.currentTarget || ev.target || null;
      if (activeRef.current) return; // ignore if already pressing
      activeRef.current = true;
      firedRef.current = false;
      setIsPressing(true);
      onStart && onStart();

      clearTimer();
      timerRef.current = setTimeout(() => {
        // Only fire if still active
        if (activeRef.current && !firedRef.current) {
          firedRef.current = true;
          try {
            onLongPress && onLongPress();
          } finally {
            onFinish && onFinish();
          }
        }
        // End the press state after firing
        stopPress(false);
      }, Math.max(0, threshold));
    },
    [clearTimer, onFinish, onLongPress, onStart, stopPress, threshold]
  );

  // Prevent context menu during a long press (mobile & desktop)
  useEffect(() => {
    if (!suppressContextMenu) return;

    const handler = (e) => {
      if (activeRef.current) {
        e.preventDefault();
      }
    };

    // Attach at document to be resilient
    document.addEventListener("contextmenu", handler, { capture: true });
    return () => {
      document.removeEventListener("contextmenu", handler, { capture: true });
    };
  }, [suppressContextMenu]);

  // Cleanup on unmount
  useEffect(() => clearTimer, [clearTimer]);

  // Public handlers to spread onto a pressable element
  const handlers = {
    onMouseDown: (e) => startPress(e),
    onMouseUp: () => stopPress(true),
    onMouseLeave: () => stopPress(true),

    onTouchStart: (e) => {
      // Avoid delayed click on touch devices
      if (e.cancelable) e.preventDefault();
      startPress(e);
    },
    onTouchEnd: () => stopPress(true),
    onTouchCancel: () => stopPress(true),
  };

  return { isPressing, handlers };
}