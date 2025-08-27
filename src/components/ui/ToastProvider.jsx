// src/components/ui/ToastProvider.jsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const remove = useCallback((id) => {
    setToasts((arr) => arr.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((opts) => {
    const id = ++idRef.current;
    const {
      message = "Action completed",
      duration = 5000,
      onUndo = null,
      undoLabel = "Undo",
      dismissLabel = "Dismiss",
    } = opts || {};

    const toast = { id, message, duration, undoLabel, dismissLabel, onUndo };
    setToasts((arr) => [...arr, toast]);

    if (duration > 0) {
      setTimeout(() => remove(id), duration);
    }
    return id;
  }, [remove]);

  const value = useMemo(() => ({ show, remove }), [show, remove]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onRemove={remove} />
    </ToastCtx.Provider>
  );
}

export function useToastCtx() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToastCtx must be used within <ToastProvider>");
  return ctx;
}

function ToastViewport({ toasts, onRemove }) {
  const [root, setRoot] = useState(null);
  useEffect(() => {
    let el = document.getElementById("toast-root");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast-root";
      document.body.appendChild(el);
    }
    setRoot(el);
  }, []);

  if (!root) return null;

  return createPortal(
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-[92vw] max-w-md">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="rounded-2xl shadow-lg px-4 py-3 bg-gray-900 text-white dark:bg-gray-800 dark:text-white backdrop-blur border border-white/10 flex items-center justify-between gap-3"
          role="status"
          aria-live="polite"
        >
          <span className="text-sm">{t.message}</span>
          <div className="flex items-center gap-2">
            {t.onUndo && (
              <button
                onClick={() => { try { t.onUndo(); } finally { onRemove(t.id); } }}
                className="text-sm underline underline-offset-2"
              >
                {t.undoLabel}
              </button>
            )}
            <button
              onClick={() => onRemove(t.id)}
              className="text-sm opacity-80 hover:opacity-100"
            >
              {t.dismissLabel}
            </button>
          </div>
        </div>
      ))}
    </div>,
    root
  );
}
