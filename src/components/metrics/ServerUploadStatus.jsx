import React from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Props:
 * - status: "idle" | "ok" | "pending" | "error"
 * - pendingCount: number
 * - lastUploadAt: string | number | Date | null
 * - lastErrorMessage: string | Error | null
 */
export function ServerUploadStatus({
                                     status = "idle",
                                     pendingCount = 0,
                                     lastUploadAt = null,
                                     lastErrorMessage = null,
                                   }) {
  const now = Date.now();

  const toTimeAgo = (value) => {
    if (!value) return "No uploads yet";
    const ts =
      value instanceof Date
        ? value.getTime()
        : typeof value === "number"
          ? value
          : Date.parse(value);

    if (Number.isNaN(ts)) return "Last upload time unknown";

    const diffMs = now - ts;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);

    if (diffSec < 10) return "Just now";
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  };

  const getStatusLabel = () => {
    switch (status) {
      case "ok":
        return "Uploaded";
      case "pending":
        return "Uploading…";
      case "error":
        return "Error uploading";
      case "idle":
      default:
        return "Idle (no uploads yet)";
    }
  };

  const getStatusTone = () => {
    switch (status) {
      case "ok":
        return {
          pill: "bg-emerald-100 border-emerald-300",
          dot: "bg-emerald-500",
          text: "text-emerald-900",
        };
      case "pending":
        return {
          pill: "bg-amber-100 border-amber-300",
          dot: "bg-amber-500",
          text: "text-amber-900",
        };
      case "error":
        return {
          pill: "bg-rose-100 border-rose-300",
          dot: "bg-rose-500",
          text: "text-rose-900",
        };
      case "idle":
      default:
        return {
          pill: "bg-slate-100 border-slate-300",
          dot: "bg-slate-400",
          text: "text-slate-900",
        };
    }
  };

  const tone = getStatusTone();
  const label = getStatusLabel();
  const timeAgo = toTimeAgo(lastUploadAt);

  const showBadge = pendingCount > 0;

  // 🔑 Safely stringify the error (prevents [object Error] React crash)
  const errorText =
    lastErrorMessage == null
      ? ""
      : typeof lastErrorMessage === "string"
        ? lastErrorMessage
        : lastErrorMessage.message
          ? lastErrorMessage.message
          : String(lastErrorMessage);

  const showError = status === "error" && !!errorText;

  return (
    <section
      className="inline-flex flex-col gap-1 text-xs sm:text-sm"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {/* Main pill row */}
      <div className="inline-flex items-center gap-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={status}
            className={[
              "inline-flex items-center gap-2 rounded-full border px-3 py-1",
              "shadow-sm",
              tone.pill,
              tone.text,
            ].join(" ")}
            initial={{ opacity: 0, scale: 0.9, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -4 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
          >
            {/* Status dot */}
            <motion.span
              className={[
                "h-2 w-2 rounded-full",
                tone.dot,
                status === "pending" ? "animate-pulse" : "",
              ].join(" ")}
              aria-hidden="true"
            />

            {/* Label */}
            <span className="font-medium">{label}</span>

            {/* Timeago with subtle fade on change */}
            <AnimatePresence mode="wait">
              <motion.span
                key={timeAgo}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="text-[0.7rem] sm:text-xs opacity-80"
              >
                {timeAgo}
              </motion.span>
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>

        {/* Pending badge */}
        <AnimatePresence>
          {showBadge && (
            <motion.div
              key="pending-badge"
              className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 text-[0.7rem] font-medium text-white"
              initial={{ opacity: 0, scale: 0.8, x: 4 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8, x: 4 }}
              aria-live="polite"
            >
              <span
                className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-white/10 px-1 text-[0.65rem]"
                aria-label={`${pendingCount} pending uploads`}
              >
                {pendingCount}
              </span>
              <span className="uppercase tracking-wide">Pending</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error line (screen-reader friendly) */}
      <AnimatePresence>
        {showError && (
          <motion.p
            key="error-line"
            className="max-w-xs text-[0.7rem] sm:text-xs text-rose-700"
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 2 }}
          >
            Last error: {errorText}
          </motion.p>
        )}
      </AnimatePresence>
    </section>
  );
}

export default ServerUploadStatus;
