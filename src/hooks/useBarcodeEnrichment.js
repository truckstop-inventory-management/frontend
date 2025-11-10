// src/hooks/useBarcodeEnrichment.js
import { useEffect, useRef, useState } from 'react';
import { cacheFirstLookup } from '../utils/cacheFirstLookup';

// Defensive: only apply if field is empty or unchanged by user
function shouldPrefill(current, incoming) {
  if (incoming == null || incoming === '') return false;
  if (current == null || current === '') return true;
  // Do not overwrite user input
  return false;
}

export default function useBarcodeEnrichment(barcode, { enabled = true } = {}) {
  const [state, setState] = useState({ status: 'idle', data: null, error: null });
  const lastBarcodeRef = useRef('');

  useEffect(() => {
    if (!enabled) return;
    const bc = String(barcode || '').trim();
    if (!bc || bc === lastBarcodeRef.current) return;

    let cancelled = false;
    setState(s => ({ ...s, status: 'loading', error: null }));
    (async () => {
      try {
        const res = await cacheFirstLookup(bc);
        if (cancelled) return;

        if (!res?.ok) {
          setState({ status: 'error', data: null, error: res?.error || 'lookup_failed' });
          return;
        }
        // res.record is the enriched cache record
        setState({ status: 'ready', data: res.record || null, error: null });
        lastBarcodeRef.current = bc;
      } catch (e) {
        if (cancelled) return;
        setState({ status: 'error', data: null, error: String(e) });
      }
    })();

    return () => { cancelled = true; };
  }, [barcode, enabled]);

  return state; // { status: 'idle'|'loading'|'ready'|'error', data, error }
}

// Helper to safely copy fields without clobbering user input
export function prefillFieldsIfEmpty(formState, setFormState, enrichment) {
  if (!enrichment) return;
  const next = { ...formState };
  let changed = false;

  if (shouldPrefill(next.brand, enrichment.brand)) {
    next.brand = enrichment.brand;
    changed = true;
  }
  if (shouldPrefill(next.category, enrichment.category)) {
    next.category = enrichment.category;
    changed = true;
  }
  if (shouldPrefill(next.imageURL, enrichment.imageURL)) {
    next.imageURL = enrichment.imageURL;
    changed = true;
  }
  if (changed) setFormState(next);
}
