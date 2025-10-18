// src/features/barcode/DetectionOverlay.jsx
export default function DetectionOverlay() {
  return (
    <div
      className="pointer-events-none fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 60 }}
    >
      <div className="rounded-xl border-2 border-white/80 w-[70vw] max-w-[420px] h-[40vh]" />
    </div>
  );
}
