import { useState } from 'react'
import { scanOnce } from './features/barcode/scanBridge'
import BarcodeScannerSheet from './features/barcode/BarcodeScannerSheet'

export default function ScanTest() {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ padding: 16 }}>
      <button
        onClick={async () => {
          console.log('[DirectScan] clicked')
          try {
            const r = await scanOnce()
            console.log('[DirectScan] result:', r)
            alert(`Direct scan result: ${r ? r.text : 'no result'}`)
          } catch (err) {
            console.error('[DirectScan] error:', err)
            alert(`Direct scan error: ${err?.message || String(err)}`)
          }
        }}
        style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: 8, marginRight: 8 }}
      >
        Direct Scan (no sheet)
      </button>

      <button
        onClick={() => setOpen(true)}
        style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: 8 }}
      >
        Open Sheet
      </button>

      {open && (
        <BarcodeScannerSheet
          onClose={() => setOpen(false)}
          onDecoded={(r) => console.log('[Sheet] decoded:', r)}
        />
      )}
    </div>
  )
}
