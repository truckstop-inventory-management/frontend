// src/features/barcode/BarcodeScannerSheet.jsx
import { useEffect, useRef, useState, useCallback } from 'react';
import { isNative, scanOnce } from './scanBridge';
import { WebContinuousScanner } from './scanWeb';
import DetectionOverlay from './DetectionOverlay';
import { recordMiss, recordSuccess, getSummary } from './metrics';
import { successFeedback } from './feedback';

export default function BarcodeScannerSheet({ onClose, onDecoded }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [retailOnly, setRetailOnly] = useState(true);
  const [lastFormat, setLastFormat] = useState('');
  const videoRef = useRef(null);
  const webScannerRef = useRef(null);

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Web: attach live preview + start continuous scan with retail filter
  useEffect(() => {
    if (isNative()) return;
    const scanner = new WebContinuousScanner();
    webScannerRef.current = scanner;

    let mounted = true;

    (async () => {
      try {
        const video = videoRef.current;
        if (!video) return;

        await scanner.attach(video);
        await scanner.pickBackCamera();

        await scanner.start(
          {
            onDecoded: async (text, format, ms) => {
              if (!mounted) return;
              setLastFormat(format || '');
              recordSuccess(ms ?? 0);
              await successFeedback();
              onDecoded?.({ text, format });
              onClose?.();
            },
            onError: () => {
              // ignore transient errors while scanning
            },
            onStatus: ({ format }) => {
              if (!mounted) return;
              if (format) setLastFormat(format);
            },
          },
          { retailOnly }
        );

        // Torch probe: try toggling false; if it succeeds at least once, it's supported
        const ok = await scanner.setTorch(false);
        setTorchSupported(!!ok);
      } catch (e) {
        setError('Camera not available or permission denied.');
      }
    })();

    return () => {
      mounted = false;
      scanner.stop().catch(() => {});
    };
  }, [onClose, onDecoded, retailOnly]);

  // Native single-shot
  const handleNativeStart = useCallback(async () => {
    setBusy(true);
    setError('');
    const t0 = performance.now();
    try {
      // Adjust requested formats based on retail toggle happens inside scanOnce for native
      const res = await scanOnce();
      const ms = Math.round(performance.now() - t0);

      if (res?.text) {
        setLastFormat(res.format || '');
        recordSuccess(ms);
        await successFeedback();
        onDecoded?.(res);
        onClose?.();
      } else {
        recordMiss();
        setError("Didn't catch that—try again or enter manually.");
      }
    } catch {
      recordMiss();
      setError('Camera permission denied or unavailable.');
    } finally {
      setBusy(false);
    }
  }, [onDecoded, onClose]);

  const handleCancel = useCallback(async () => {
    try {
      await webScannerRef.current?.stop();
    } catch {}
    onClose?.();
  }, [onClose]);

  const handleToggleTorch = useCallback(async () => {
    if (isNative()) {
      // Native torch wiring can be added later via plugin call.
      return;
    }
    const wanted = !torchOn;
    const ok = await webScannerRef.current?.setTorch(wanted);
    if (ok) setTorchOn(wanted);
  }, [torchOn]);

  const summary = getSummary();

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-white dark:bg-neutral-900 shadow-2xl p-4
                 pb-[max(env(safe-area-inset-bottom),1rem)]"
      role="dialog"
      aria-labelledby="scan-title"
    >
      <div className="flex items-center justify-between">
        <h3 id="scan-title" className="text-lg font-semibold">Scan a barcode</h3>
        <div className="flex items-center gap-2">
          <label className="text-xs flex items-center gap-1 select-none">
            <input
              type="checkbox"
              checked={retailOnly}
              onChange={(e) => setRetailOnly(e.target.checked)}
            />
            Retail formats only
          </label>

          {!isNative() && torchSupported && (
            <button
              onClick={handleToggleTorch}
              className="text-sm rounded border px-2 py-1"
              title="Toggle flashlight"
            >
              {torchOn ? 'Torch Off' : 'Torch On'}
            </button>
          )}

          <button
            onClick={isNative() ? onClose : handleCancel}
            className="text-sm opacity-70 hover:opacity-100 focus:outline-none focus:ring"
          >
            {isNative() ? 'Close' : 'Cancel'}
          </button>
        </div>
      </div>

      <div className="py-4 relative">
        {/* Live preview for web */}
        {!isNative() && (
          <>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full rounded-lg bg-black aspect-video"
              style={{ maxHeight: 360 }}
            />
            <DetectionOverlay />
          </>
        )}

        {/* Native single-shot */}
        {isNative() && (
          <div className="pt-2">
            <p className="text-sm opacity-80 mb-3">
              We’ll open the camera and scan once. Hold steady and align the code within the frame.
            </p>
            <button
              onClick={handleNativeStart}
              disabled={busy}
              className="px-4 py-2 rounded-xl border hover:bg-neutral-50 dark:hover:bg-neutral-800
                         focus:outline-none focus:ring"
            >
              {busy ? 'Scanning…' : 'Start Scan'}
            </button>
          </div>
        )}

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </div>

      {/* Status footer */}
      <div className="mt-3 text-xs opacity-80 flex items-center justify-between">
        <div>
          <span className="mr-3">Format: <strong>{lastFormat || '—'}</strong></span>
          <span className="mr-3">
            Torch: <strong>{torchSupported ? (torchOn ? 'On' : 'Off') : 'N/A'}</strong>
          </span>
        </div>
        <div>
          Success: <strong>{summary.successCount}</strong> •
          Miss: <strong>{summary.missCount}</strong> •
          Avg: <strong>{summary.avgMs} ms</strong>
        </div>
      </div>
    </div>
  );
}
