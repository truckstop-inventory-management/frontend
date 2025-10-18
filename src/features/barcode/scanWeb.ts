// src/features/barcode/scanWeb.ts
import { BrowserMultiFormatReader } from '@zxing/browser';

export type WebScanCallbacks = {
  onDecoded: (text: string, format?: string, durationMs?: number) => void;
  onError?: (err: unknown) => void;
  onStatus?: (status: { format?: string }) => void; // live format hint (optional)
};

export type WebScanOptions = {
  retailOnly?: boolean; // UPC/EAN/Code128 only
};

function isRetailFormat(fmt?: string) {
  if (!fmt) return false;
  const f = fmt.toUpperCase();
  return f.includes('EAN') || f.includes('UPC') || f.includes('CODE_128');
}

export class WebContinuousScanner {
  private reader = new BrowserMultiFormatReader();
  private videoEl: HTMLVideoElement | null = null;
  private running = false;
  private currentDeviceId: string | undefined;

  async attach(video: HTMLVideoElement) {
    this.videoEl = video;
    this.videoEl.playsInline = true;
  }

  async pickBackCamera(): Promise<string | undefined> {
    const devices = await BrowserMultiFormatReader.listVideoInputDevices();
    const back = devices.find((d) => /back|environment/i.test(d.label));
    this.currentDeviceId = (back || devices[0])?.deviceId;
    return this.currentDeviceId;
  }

  async start(cb: WebScanCallbacks, opts: WebScanOptions = {}) {
    if (!this.videoEl) throw new Error('No video element attached');
    if (!this.currentDeviceId) await this.pickBackCamera();
    this.running = true;

    const t0 = performance.now();

    try {
      await this.reader.decodeFromVideoDevice(
        this.currentDeviceId,
        this.videoEl,
        (result, err) => {
          if (!this.running) return;

          if (result) {
            const text = result.getText?.() ?? '';
            const format = String(result.getBarcodeFormat?.() ?? '');
            cb.onStatus?.({ format });

            // Apply retail-only filter if enabled
            if (opts.retailOnly && !isRetailFormat(format)) return;

            if (text) {
              const ms = Math.round(performance.now() - t0);
              this.stop(); // auto-stop on first valid decode
              cb.onDecoded(text, format, ms);
            }
          } else if (err && cb.onError) {
            cb.onError(err);
          }
        }
      );
    } catch (e) {
      cb.onError?.(e);
    }
  }

  async stop() {
    this.running = false;
    try {
      this.reader.reset?.();
    } catch {}
    if (this.videoEl?.srcObject) {
      try {
        const stream = this.videoEl.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
      } catch {}
      this.videoEl.srcObject = null;
    }
  }

  /** Torch control (best-effort). Works on a subset of mobile browsers. */
  async setTorch(on: boolean): Promise<boolean> {
    const track = this.getVideoTrack();
    if (!track) return false;

    // @ts-expect-error experimental
    const caps = track.getCapabilities?.();
    // @ts-expect-error experimental
    if (!caps?.torch) return false;

    try {
      // @ts-expect-error experimental
      await track.applyConstraints({ advanced: [{ torch: on }] });
      return true;
    } catch {
      return false;
    }
  }

  private getVideoTrack(): MediaStreamTrack | null {
    const stream = this.videoEl?.srcObject as MediaStream | null;
    const track = stream?.getVideoTracks?.()[0] ?? null;
    return track || null;
  }
}
