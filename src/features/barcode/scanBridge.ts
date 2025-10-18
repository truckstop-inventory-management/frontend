// src/features/barcode/scanBridge.ts
import { isNative as _isNative } from './platform';

export type ScanResult = { text: string; format?: string } | null;

export function isNative() {
  return _isNative();
}

export async function scanOnce(): Promise<ScanResult> {
  if (_isNative()) {
    const { BarcodeScanner, BarcodeFormat } = await import('@capacitor-mlkit/barcode-scanning');
    const { barcodes } = await BarcodeScanner.scan({
      formats: [
        BarcodeFormat.Ean13,
        BarcodeFormat.Ean8,
        BarcodeFormat.UpcA,
        BarcodeFormat.UpcE,
        BarcodeFormat.Code128,
        BarcodeFormat.QrCode,
      ],
    });
    const best = barcodes?.[0];
    return best ? { text: best.rawValue ?? '', format: String(best.format ?? '') } : null;
  }

  const { BrowserMultiFormatReader } = await import('@zxing/browser');
  const reader = new BrowserMultiFormatReader();

  const devices = await BrowserMultiFormatReader.listVideoInputDevices();
  let deviceId: string | undefined = undefined;
  for (const d of devices) {
    if (d.kind === 'videoinput' && /back|environment/i.test(`${(d as MediaDeviceInfo).label}`)) {
      deviceId = (d as MediaDeviceInfo).deviceId;
      break;
    }
  }

  const video = document.createElement('video');
  video.playsInline = true;
  document.body.appendChild(video);

  try {
    const result = await reader.decodeOnceFromVideoDevice(deviceId, video);
    const text: string = result?.getText?.() ?? '';
    const format = String(result?.getBarcodeFormat?.());
    return text ? { text, format } : null;
  } finally {
    try {
      const stream = video.srcObject as MediaStream | null;
      stream?.getTracks().forEach((t) => t.stop());
    } catch {}
    video.pause();
    video.srcObject = null;
    video.remove();
  }
}
