// src/hooks/useEditModalKeyboard.js
import { useEffect } from "react";

/**
 * Centralizes modal keyboard behavior:
 * - Initial focus into firstFieldRef when opened
 * - Focus trap within modalRef while open
 * - ESC to close
 * - ENTER to save (when focus is inside an input/select/textarea)
 */
export default function useEditModalKeyboard({
                                               isOpen,
                                               modalRef,
                                               firstFieldRef,
                                               onClose,
                                               onSave,
                                             }) {
  // Initial focus + focus trap
  useEffect(() => {
    if (!isOpen) return;

    // Focus first field once opened
    const t = setTimeout(() => {
      if (firstFieldRef?.current) firstFieldRef.current.focus();
    }, 0);

    const node = modalRef?.current;
    if (!node) return () => clearTimeout(t);

    const selector = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");

    const getFocusable = () => Array.from(node.querySelectorAll(selector));

    const onKeyDown = (e) => {
      // ESC closes
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== "Tab") return;

      const focusables = getFocusable();
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement;

      if (e.shiftKey) {
        if (current === first || !node.contains(current)) {
          last.focus();
          e.preventDefault();
        }
      } else {
        if (current === last) {
          first.focus();
          e.preventDefault();
        }
      }
    };

    node.addEventListener("keydown", onKeyDown);
    return () => {
      clearTimeout(t);
      node.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, modalRef, firstFieldRef, onClose]);

  // Enter-to-save (when focused inside form controls)
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === "Enter") {
        const tag = (document.activeElement?.tagName || "").toLowerCase();
        if (tag === "input" || tag === "select" || tag === "textarea") {
          e.preventDefault();
          onSave?.();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onSave]);
}
