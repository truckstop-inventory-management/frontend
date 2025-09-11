export default function Spinner({ size = 16, label = "Loading…" }) {
  return (
    <div className="inline-flex items-center gap-2" role="status" aria-live="polite">
      <svg
        className="animate-spin"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          className="opacity-20"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
        />
        <path
          d="M22 12a10 10 0 0 1-10 10"
          className="opacity-90"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
      <span className="text-sm">{label}</span>
    </div>
  );
}
