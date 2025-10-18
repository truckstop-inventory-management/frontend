// src/features/barcode/feedback.ts
export async function successFeedback() {
  try {
    if ('vibrate' in navigator) navigator.vibrate?.(30);
  } catch {}

  // Optional: attempt Capacitor Haptics if present (no hard dependency)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const C: any = (globalThis as any).Capacitor;
    if (C) {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics').catch(() => ({} as any));
      await Haptics?.impact?.({ style: ImpactStyle?.Medium ?? 'Medium' });
    }
  } catch {}
}
