// src/features/barcode/decodeWorker.js
// Minimal wrapper expected by BarcodeScannerSheet. Replace with your ZXing integration.
let zxing;
async function loadZX() {
  if (zxing) return zxing;
  // Lazy load your actual decoder (WASM path must be correct under Vite build)
  // Example: const lib = await import('../../utils/barcode/zxingLoader.js');
  const lib = await import('../../utils/barcode/zxingLoader.js'); // adjust if different
  zxing = lib;
  return zxing;
}

export async function decodeOnce(videoEl, { retailOnly }) {
  const lib = await loadZX();
  if (!lib || !lib.decodeFromVideo) return null;
  // retailOnly gives the upstream a hint to restrict formats
  return lib.decodeFromVideo(videoEl, { retailOnly }); // expected shape: { text, format } or null
}
