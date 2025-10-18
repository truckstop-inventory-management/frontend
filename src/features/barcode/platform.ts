// src/features/barcode/platform.ts
export function getCapacitor() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (globalThis as any).Capacitor;
}

export function isNative(): boolean {
  const C = getCapacitor();
  return !!(C && (C.isNativePlatform?.() || C.getPlatform?.() !== 'web'));
}

export function isWeb(): boolean {
  return !isNative();
}
