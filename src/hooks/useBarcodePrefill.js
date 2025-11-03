// src/hooks/useBarcodePrefill.js
import { useEffect, useState } from 'react';
import { getCachedBarcode } from '../utils/barcodeCache';

export default function useBarcodePrefill(barcode) {
  const [prefill, setPrefill] = useState(null);
  const [meta, setMeta] = useState({ seenText: '', cached: false });

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!barcode) { if (mounted) { setPrefill(null); setMeta({ seenText: '', cached: false }); } return; }
      try {
        const cached = await getCachedBarcode(barcode);
        if (!mounted) return;
        if (cached) {
          const date = new Date(cached.lastSeenAt);
          setMeta({ seenText: `Seen ${cached.seenCount}× • lastSeen: ${date.toLocaleString()}`, cached: true });
          setPrefill({ barcode, itemName: cached.name || '', price: typeof cached.price === 'number' ? cached.price : '', quantity: 1, location: '' });
        } else {
          setMeta({ seenText: '', cached: false });
          setPrefill({ barcode, itemName: '', price: '', quantity: 1, location: '' });
        }
      } catch {
        if (!mounted) return;
        setMeta({ seenText: '', cached: false });
        setPrefill({ barcode, itemName: '', price: '', quantity: 1, location: '' });
      }
    })();
    return () => { mounted = false; };
  }, [barcode]);

  return { prefill, meta };
}
