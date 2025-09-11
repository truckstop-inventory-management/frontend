// src/hooks/useToast.js
//
// Lightweight toast system with optional Undo action.
// API: toast.show({ message, duration, onUndo, ariaLive, focusUndo })
// - Undo is a real <button> (tabbable) with optional auto-focus.
// - Includes an offscreen ARIA live region that mirrors the latest toast message.
// - No JSX (safe to keep .js extension).

import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

const h = React.createElement;

// -------------------------------
// Module-level store & utilities
// -------------------------------
let _hostMounted = false;
let _root = null;
let _containerEl = null;

const listeners = new Set();
let toasts = [];

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) fn(toasts);
}

function ensureHost() {
  if (_hostMounted) return;
  _containerEl = document.getElementById("toast-host");
  if (!_containerEl) {
    _containerEl = document.createElement("div");
    _containerEl.id = "toast-host";
    document.body.appendChild(_containerEl);
  }
  _root = createRoot(_containerEl);
  _root.render(h(ToastHost));
  _hostMounted = true;
}

function nextId() {
  return "t_" + Math.random().toString(36).slice(2, 9);
}

function dismiss(id) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function dismissAll() {
  toasts = [];
  emit();
}

// -------------------------------
// Public hook API
// -------------------------------
export default function useToast() {
  useEffect(() => {
    ensureHost();
  }, []);

  const show = ({
                  message,
                  duration = 4000,
                  onUndo,
                  ariaLive = "polite",
                  focusUndo = true,
                }) => {
    const id = nextId();
    const toast = {
      id,
      message: String(message ?? ""),
      duration: Number.isFinite(duration) ? duration : 4000,
      onUndo: typeof onUndo === "function" ? onUndo : null,
      ariaLive: ariaLive === "assertive" ? "assertive" : "polite",
      focusUndo: !!focusUndo,
      createdAt: Date.now(),
    };
    toasts = [...toasts, toast];
    emit();

    if (toast.duration > 0) {
      setTimeout(() => dismiss(id), toast.duration);
    }
    return id;
  };

  return { show, dismissAll };
}

// -------------------------------
// Host & items (rendered in portal)
// -------------------------------
function ToastHost() {
  const [list, setList] = useState(toasts);

  // For live region mirroring
  const [liveMsg, setLiveMsg] = useState("");
  const [liveMode, setLiveMode] = useState("polite");
  const clearTimerRef = useRef(null);

  useEffect(() => subscribe(setList), []);

  // Whenever the list changes, announce the latest toast message
  useEffect(() => {
    if (!list || list.length === 0) return;

    const latest = list[list.length - 1];
    // Update live region text and mode
    setLiveMode(latest.ariaLive || "polite");
    setLiveMsg(latest.message || "");

    // Clear message shortly after to allow repeat announcements
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(() => setLiveMsg(""), 2500);

    return () => {
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }
    };
  }, [list]);

  // Offscreen styles for accessible-only content
  const srOnlyStyle = {
    position: "absolute",
    width: "1px",
    height: "1px",
    padding: 0,
    margin: "-1px",
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    border: 0,
  };

  return h(
    React.Fragment,
    null,
    // Visual toasts stack (clickable)
    h(
      "div",
      {
        "aria-live": "off",
        className:
          "pointer-events-none fixed bottom-4 right-4 z-[9999] flex flex-col gap-2",
      },
      list.map((t) => h(ToastItem, { key: t.id, toast: t }))
    ),
    // Offscreen live region that mirrors latest message
    h(
      "div",
      {
        style: srOnlyStyle,
        "aria-live": liveMode,
        "aria-atomic": "true",
      },
      liveMsg
    )
  );
}

function ToastItem({ toast }) {
  const { id, message, onUndo, ariaLive, focusUndo } = toast;
  const btnRef = useRef(null);
  const msgId = `${id}-msg`;

  useEffect(() => {
    if (onUndo && focusUndo && btnRef.current) {
      const hnd = setTimeout(() => {
        try {
          btnRef.current.focus();
        } catch {}
      }, 0);
      return () => clearTimeout(hnd);
    }
  }, [onUndo, focusUndo]);

  const onUndoKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (onUndo) onUndo();
      dismiss(id);
    }
  };

  const closeBtn = h(
    "button",
    {
      onClick: () => dismiss(id),
      "aria-label": "Dismiss notification",
      className:
        "text-[var(--color-muted)] hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded outline-none p-1",
    },
    "×"
  );

  const header = h(
    "div",
    { className: "flex items-start justify-between gap-3" },
    h("p", { id: msgId, className: "text-sm leading-5" }, message),
    closeBtn
  );

  const undoBtn =
    onUndo &&
    h(
      "div",
      { className: "mt-2" },
      h(
        "button",
        {
          ref: btnRef,
          onClick: () => {
            onUndo();
            dismiss(id);
          },
          onKeyDown: onUndoKeyDown,
          className:
            "underline text-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded outline-none px-1 py-0.5",
        },
        "Undo"
      )
    );

  return h(
    "div",
    {
      role: onUndo ? "alertdialog" : "alert",
      "aria-live": ariaLive,
      "aria-describedby": msgId,
      className:
        "pointer-events-auto rounded-lg shadow-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] px-3 py-2 min-w-[240px] max-w-[360px]",
    },
    header,
    undoBtn
  );
}
