// src/components/inventory/AddItemForm.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import BarcodeScannerSheet from "../../features/barcode/BarcodeScannerSheet";
import { upsertBarcode } from "../../utils/barcodeCache.js";
import { cacheFirstLookup } from "../../utils/cacheFirstLookup"; // ✅ cache-first enrichment

export default function AddItemForm({
                                      newItem,
                                      setNewItem,
                                      onAdd,
                                      disabled,
                                      prefill,
                                      prefillNote,
                                    }) {
  const [openScan, setOpenScan] = useState(false);
  const [enriching, setEnriching] = useState(false); // ✅ enrichment indicator
  const [enrichGlow, setEnrichGlow] = useState({ brand: false, category: false, imageURL: false }); // ✨ highlight tint
  const barcodeInputRef = useRef(null);
  const lastEnrichedBarcodeRef = useRef("");
  const debounceRef = useRef(null);
  const lastRunRef = useRef(0);
  const firstFillRef = useRef({ brand: false, category: false, imageURL: false });

  // Focus barcode field when scanner suggests manual entry
  useEffect(() => {
    const onFocusReq = () => {
      barcodeInputRef.current?.focus?.();
      barcodeInputRef.current?.select?.();
    };
    window.addEventListener("tsinv:focus-barcode-input", onFocusReq);
    return () => window.removeEventListener("tsinv:focus-barcode-input", onFocusReq);
  }, []);

  // Seed blanks from prefill (does not clobber user edits)
  useEffect(() => {
    if (!prefill) return;
    setNewItem((prev) => {
      const next = { ...prev };
      if (!next.itemName) next.itemName = prefill.itemName ?? "";
      if (next.price === undefined || next.price === null || next.price === "")
        next.price = prefill.price ?? "";
      if (next.quantity === undefined || next.quantity === null || next.quantity === "")
        next.quantity = prefill.quantity ?? 1;
      if (!next.location) next.location = prefill.location ?? "";
      if (prefill.barcode) next.barcode = prefill.barcode;
      return next;
    });
  }, [prefill, setNewItem]);

  // ✴️ Helper: apply enrichment fills only if empty + short highlight
  const applyEnrichment = useCallback(
    (record) => {
      if (!record) return;
      const { brand, category, imageURL } = record;

      setNewItem((prev) => {
        const next = { ...prev };
        let changed = false;

        if (!next.brand && brand && !firstFillRef.current.brand) {
          next.brand = brand;
          changed = true;
          firstFillRef.current.brand = true;
          setEnrichGlow((g) => ({ ...g, brand: true }));
          setTimeout(() => setEnrichGlow((g) => ({ ...g, brand: false })), 300);
        }
        if (!next.category && category && !firstFillRef.current.category) {
          next.category = category;
          changed = true;
          firstFillRef.current.category = true;
          setEnrichGlow((g) => ({ ...g, category: true }));
          setTimeout(() => setEnrichGlow((g) => ({ ...g, category: false })), 300);
        }
        if (!next.imageURL && imageURL && !firstFillRef.current.imageURL) {
          next.imageURL = imageURL;
          changed = true;
          firstFillRef.current.imageURL = true;
          setEnrichGlow((g) => ({ ...g, imageURL: true }));
          setTimeout(() => setEnrichGlow((g) => ({ ...g, imageURL: false })), 300);
        }
        return changed ? next : prev;
      });
    },
    [setNewItem]
  );

  // 🔁 Debounced enrichment lookup (200 ms, StrictMode-safe)
  const runEnrichmentDebounced = useCallback(
    (barcode) => {
      if (!barcode) return;
      const now = Date.now();
      if (now - lastRunRef.current < 50) return; // guard duplicate mount
      lastRunRef.current = now;
      if (debounceRef.current) clearTimeout(debounceRef.current);

      debounceRef.current = setTimeout(async () => {
        try {
          setEnriching(true);
          const res = await cacheFirstLookup(barcode);
          if (res?.ok && res?.record) applyEnrichment(res.record);
          lastEnrichedBarcodeRef.current = barcode;
        } catch (err) {
          if (import.meta?.env?.DEV)
            console.debug("[enrichment] debounce lookup failed", err);
        } finally {
          setEnriching(false);
        }
      }, 200);
    },
    [applyEnrichment]
  );

  useEffect(() => () => debounceRef.current && clearTimeout(debounceRef.current), []);

  const onChange = (field) => (e) => {
    const val = e.target.value;
    setNewItem((prev) => ({ ...prev, [field]: val }));
    if (field === "barcode") runEnrichmentDebounced(val);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (disabled) return;
    const maybe = onAdd();
    try {
      await Promise.resolve(maybe);
      if (newItem?.barcode) {
        await upsertBarcode({
          barcode: newItem.barcode,
          name: newItem.itemName,
          price: Number(newItem.price),
        });
      }
    } catch {}
  };

  const handleDecoded = ({ text }) => {
    setNewItem((prev) => ({ ...prev, barcode: text }));
  };

  const cachedBadge = prefillNote ? (
    <span className="ml-2 text-[10px] px-1 py-0.5 rounded bg-yellow-100 text-yellow-800">
      from cache
    </span>
  ) : null;

  const showBrand =
    enriching || (newItem?.brand != null && String(newItem.brand).length > 0);
  const showCategory =
    enriching || (newItem?.category != null && String(newItem.category).length > 0);

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-5"
    >
      <div className="flex items-center gap-2 sm:col-span-5">
        <input
          ref={barcodeInputRef}
          className="rounded border px-2 py-1 w-full"
          placeholder="Barcode / SKU"
          value={newItem?.barcode ?? ""}
          onChange={onChange("barcode")}
          aria-label="Barcode or SKU"
        />
        {/* 🔁 DEV-only re-run lookup */}
        {import.meta?.env?.DEV && (
          <button
            type="button"
            onClick={() => runEnrichmentDebounced(newItem?.barcode)}
            className="rounded border border-gray-300 px-2 py-1 text-xs"
            title="Re-run barcode enrichment (dev)"
          >
            Re-run
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpenScan(true)}
          disabled={disabled}
          className="rounded border px-3 py-1 disabled:opacity-60"
          aria-label="Scan barcode"
          title="Scan barcode"
        >
          Scan
        </button>
      </div>

      <div className="sm:col-span-5" aria-live="polite">
        {enriching ? (
          <p className="text-xs text-gray-500 mt-[-4px] mb-[-2px]">
            Looking up product details…
          </p>
        ) : null}
      </div>

      {prefillNote ? (
        <div className="sm:col-span-5">
          <p className="mt-1 text-xs opacity-70" aria-live="polite">
            {prefillNote}
          </p>
        </div>
      ) : null}

      <div className="flex items-center">
        <input
          className="rounded border px-2 py-1 w-full"
          placeholder="Item name"
          value={newItem?.itemName || ""}
          onChange={onChange("itemName")}
          required
          aria-label="Item name"
        />
        {cachedBadge}
      </div>

      <input
        className="rounded border px-2 py-1"
        type="number"
        placeholder="Qty"
        value={newItem?.quantity ?? ""}
        onChange={onChange("quantity")}
        min="0"
        step="1"
        required
        aria-label="Quantity"
      />
      <div className="flex items-center">
        <input
          className="rounded border px-2 py-1 w-full"
          type="number"
          placeholder="Price"
          value={newItem?.price ?? ""}
          onChange={onChange("price")}
          min="0"
          step="0.01"
          required
          aria-label="Price"
        />
        {cachedBadge}
      </div>

      {showBrand ? (
        <input
          className={`rounded border px-2 py-1 transition-colors duration-300 ${
            enrichGlow.brand ? "bg-yellow-50" : "bg-white"
          }`}
          placeholder="Brand (auto-filled)"
          value={newItem?.brand ?? ""}
          onChange={onChange("brand")}
          aria-label="Brand"
        />
      ) : (
        <div className="hidden sm:block" />
      )}

      {showCategory ? (
        <input
          className={`rounded border px-2 py-1 transition-colors duration-300 ${
            enrichGlow.category ? "bg-yellow-50" : "bg-white"
          }`}
          placeholder="Category (auto-filled)"
          value={newItem?.category ?? ""}
          onChange={onChange("category")}
          aria-label="Category"
        />
      ) : (
        <div className="hidden sm:block" />
      )}

      <select
        className="rounded border px-2 py-1"
        value={newItem?.location || "C-Store"}
        onChange={onChange("location")}
        required
        aria-label="Location"
      >
        <option value="C-Store">C-Store</option>
        <option value="Restaurant">Restaurant</option>
      </select>

      <button
        type="submit"
        disabled={disabled}
        className="rounded bg-[var(--color-primary)] px-3 py-1 text-white disabled:opacity-60"
      >
        Add
      </button>

      {openScan && (
        <BarcodeScannerSheet
          onClose={() => setOpenScan(false)}
          onDecoded={handleDecoded}
        />
      )}
    </form>
  );
}
