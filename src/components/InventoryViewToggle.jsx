// src/components/InventoryViewToggle.jsx
import { LOCATION } from '../utils/location';

const VIEWS = [LOCATION.C_STORE, LOCATION.RESTAURANT];

export default function InventoryViewToggle({ value, onChange, counts = {} }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {VIEWS.map((v) => {
        const active = value === v;
        const count = counts[v] ?? 0;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            aria-pressed={active}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: active ? '2px solid currentColor' : '1px solid #ccc',
              fontWeight: active ? 600 : 400,
              background: active ? 'transparent' : 'white',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>{v}</span>
            <span
              aria-label={`${v} count: ${count}`}
              style={{
                minWidth: 20,
                height: 20,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 999,
                border: '1px solid #ccc',
                fontSize: 12,
                padding: '0 6px',
              }}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}