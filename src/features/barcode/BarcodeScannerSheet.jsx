// src/features/barcode/BarcodeScannerSheet.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import DetectionOverlay from "./DetectionOverlay.jsx";
import { recordMiss, recordSuccess, summary } from "../../utils/metrics.js";

const RETAIL_KEY = "tsinv:scanRetailOnly";
const isDev = typeof window !== "undefined" && (window.location.search.includes("dev=1") || window.location.search.includes("scanner=1"));

/**
 * Props:
 * - onClose(): void
 * - onDecoded({ text, format }): void
 */
export default function BarcodeScannerSheet({ onClose, onDecoded }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(0);
  const runningRef = useRef(false);
  const lastTextRef = useRef(null);
  const lastDecodeAtRef = useRef(0);
  const focusablesRef = useRef([]);
  const [retailOnly, setRetailOnly] = useState(() => {
    try { return localStorage.getItem(RETAIL_KEY) !== "0"; } catch { return true; }
  });
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [err, setErr] = useState("");
  const [footer, setFooter] = useState({ success: 0, miss: 0, avg: 0, p50: 0, p90: 0 });

  // Focus trap
  const sheetRef = useRef(null);
  useEffect(() => {
    if (!sheetRef.current) return;
    const sels = 'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';
    const nodes = [...sheetRef.current.querySelectorAll(sels)].filter(el => !el.hasAttribute('disabled'));
    focusablesRef.current = nodes;
    nodes[0]?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); handleClose(); }
      if (e.key === "Tab") {
        const idx = nodes.indexOf(document.activeElement);
        if (e.shiftKey && (idx <= 0)) { e.preventDefault(); nodes[nodes.length - 1]?.focus(); }
        else if (!e.shiftKey && (idx === nodes.length - 1)) { e.preventDefault(); nodes[0]?.focus(); }
      }
    };
    sheetRef.current.addEventListener("keydown", onKey);
    return () => sheetRef.current?.removeEventListener("keydown", onKey);
  }, []);

  // Persist retail filter
  useEffect(() => {
    try { localStorage.setItem(RETAIL_KEY, retailOnly ? "1" : "0"); } catch {}
  }, [retailOnly]);

  // Pause when backgrounded
  useEffect(() => {
    const vis = () => { if (document.hidden) stop(); else start().catch(() => {}); };
    document.addEventListener("visibilitychange", vis);
    return () => document.removeEventListener("visibilitychange", vis);
  }, []);

  const handleClose = useCallback(() => {
    stop();
    // Let AddItemForm focus barcode field if needed
    try { window.dispatchEvent(new CustomEvent("tsinv:focus-barcode-input")); } catch {}
    onClose?.();
  }, [onClose]);

  // Friendly error text
  const friendly = (e) => {
    if (!e) return "";
    const name = e.name || "";
    if (name === "NotAllowedError" || name === "SecurityError") return "Camera access was blocked. Please allow permission and try again.";
    if (name === "NotFoundError" || name === "OverconstrainedError") return "No suitable camera was found. Try switching devices or cameras.";
    return e.message || "Something went wrong starting the camera.";
  };

  // Torch toggle
  const setTorchIfSupported = async (enabled) => {
    try {
      const track = streamRef.current?.getVideoTracks?.()[0];
      const caps = track?.getCapabilities?.();
      if (caps && "torch" in caps) {
        await track.applyConstraints({ advanced: [{ torch: !!enabled }] });
        setTorchOn(!!enabled);
        setTorchSupported(true);
      } else {
        setTorchSupported(false);
      }
    } catch {
      setTorchSupported(false);
      setTorchOn(false);
    }
  };

  // Start camera + decode loop
  const start = useCallback(async () => {
    if (runningRef.current) return;
    setErr("");
    // Prefer rear camera; throttle resolution to lighten CPU on older phones
    const constraints = {
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        frameRate: { ideal: 24, max: 30 },
      },
    };
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      await setTorchIfSupported(false);
      runningRef.current = true;
      decodeLoop();
    } catch (e) {
      setErr(friendly(e));
      recordMiss();
      setFooter(summary());
    }
  }, []);

  const stop = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    try {
      streamRef.current?.getTracks?.().forEach(t => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    } catch {}
    if (isDev) console.log("[Scanner] Stopped, leak check ok");
  }, []);

  // Duplicate suppression & backoff loop
  async function decodeLoop() {
    if (!runningRef.current) return;
    const t0 = performance.now();

    // Lazy-load the web decoder (keeps main bundle small)
    const { decodeOnce } = await import("./decodeWorker.js").catch(() => ({ decodeOnce: null }));
    if (!decodeOnce) {
      setErr("Scanner unavailable on this device/browser.");
      recordMiss(); setFooter(summary()); return;
    }

    try {
      const res = await decodeOnce(videoRef.current, { retailOnly });
      const t1 = performance.now();
      if (res && res.text) {
        // Suppress immediate duplicates
        if (lastTextRef.current === res.text && (t1 - lastDecodeAtRef.current) < 800) {
          rafRef.current = requestAnimationFrame(decodeLoop);
          return;
        }
        lastTextRef.current = res.text;
        lastDecodeAtRef.current = t1;

        recordSuccess(t1 - t0);
        setFooter(summary());
        // Auto-stop after 1 success
        stop();
        onDecoded?.({ text: res.text, format: res.format });
        onClose?.();
        return;
      }
      // miss → small backoff
      recordMiss();
      setFooter(summary());
      await new Promise(r => setTimeout(r, 140)); // backoff to reduce CPU
    } catch {
      recordMiss();
      setFooter(summary());
      await new Promise(r => setTimeout(r, 200));
    }
    rafRef.current = requestAnimationFrame(decodeLoop);
  }

  // Mount/unmount
  useEffect(() => { start(); return () => stop(); }, [start, stop]);

  const onClickManual = () => { handleClose(); /* focus barcode via event */ };
  const onToggleRetail = () => setRetailOnly(r => !r);
  const onToggleTorch = () => setTorchIfSupported(!torchOn);

  return (
    <div
      ref={sheetRef}
      role="dialog"
      aria-modal="true"
      aria-label="Barcode scanner"
      className="fixed inset-0 z-[50] bg-black/80 flex flex-col"
    >
      <div className="flex items-center justify-between p-3 text-white">
        <div className="font-semibold">Scan a barcode</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-2 py-1 rounded bg-white/10 border border-white/30"
            onClick={onToggleRetail}
            aria-pressed={retailOnly}
            title="Limit to retail formats (UPC/EAN/Code128)"
          >
            Retail formats {retailOnly ? "ON" : "OFF"}
          </button>
          <button
            type="button"
            className="px-2 py-1 rounded bg-white/10 border border-white/30 disabled:opacity-50"
            onClick={onToggleTorch}
            disabled={!torchSupported}
            aria-disabled={!torchSupported}
            title={torchSupported ? "Toggle torch" : "Torch not supported"}
          >
            {torchOn ? "Torch On" : "Torch Off"}
          </button>
          <button
            type="button"
            className="px-2 py-1 rounded bg-white/10 border border-white/30"
            onClick={handleClose}
            aria-label="Close scanner"
          >
            Close
          </button>
        </div>
      </div>

      <div className="relative flex-1">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
          autoPlay
          aria-label="Live camera view"
        />
        <DetectionOverlay />
      </div>

      {err ? (
        <div className="p-3 text-center text-red-200 text-sm">
          {err} <button className="underline ml-2" onClick={() => { setErr(""); stop(); start(); }}>Try again</button>
        </div>
      ) : null}

      <div className="p-3 flex items-center justify-between text-white/80 text-xs">
        <div>
          <button className="underline" onClick={onClickManual}>Enter manually instead</button>
        </div>
        {isDev && (
          <div>
            <span>ok:{footer.success} miss:{footer.miss} </span>
            <span>avg:{footer.avg}ms p50:{footer.p50} p90:{footer.p90}</span>
          </div>
        )}
      </div>
    </div>
  );
}
