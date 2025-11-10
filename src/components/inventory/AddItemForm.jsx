// src/components/inventory/AddItemForm.jsx
import React, { useState, useEffect, useRef } from "react";
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
  const barcodeInputRef = useRef(null);
  const lastEnrichedBarcodeRef = useRef("");

  // Focus barcode field when scanner suggests manual entry
  useEffect(() => {
    const onFocusReq = () => { barcodeInputRef.current?.focus?.(); barcodeInputRef.current?.select?.(); };
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

  // 🔎 Prefill enrichment: when barcode changes, run cache-first lookup and fill brand/category/imageURL if empty
  useEffect(() => {
    const bc = String(newItem?.barcode || "").trim();
    if (!bc || bc === lastEnrichedBarcodeRef.current) return;

    let cancelled = false;

    (async () => {
      try {
        setEnriching(true); // start indicator
        const res = await cacheFirstLookup(bc);
        if (cancelled) return;
        if (!res?.ok || !res?.record) return;

        const { brand, category, imageURL } = res.record || {};
        setNewItem((prev) => {
          const next = { ...prev };
          let changed = false;

          if ((next.brand == null || next.brand === "") && brand) {
            next.brand = brand;
            changed = true;
          }
          if ((next.category == null || next.category === "") && category) {
            next.category = category;
            changed = true;
          }
          if ((next.imageURL == null || next.imageURL === "") && imageURL) {
            next.imageURL = imageURL;
            changed = true;
          }
          return changed ? next : prev;
        });

        lastEnrichedBarcodeRef.current = bc;
      } catch {
        // silent — enrichment is best-effort
      } finally {
        setEnriching(false); // stop indicator
      }
    })();

    return () => { cancelled = true; setEnriching(false); };
  }, [newItem?.barcode, setNewItem]);

  const onChange = (field) => (e) => {
    const val = e.target.value;
    setNewItem((prev) => ({ ...prev, [field]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (disabled) return;
    const maybe = onAdd();
    try {
      await Promise.resolve(maybe);
      if (newItem?.barcode) {
        await upsertBarcode({ barcode: newItem.barcode, name: newItem.itemName, price: Number(newItem.price) });
      }
    } catch {}
  };

  const handleDecoded = ({ text }) => {
    setNewItem((prev) => ({ ...prev, barcode: text }));
  };

  // Light visual for "cached" fields (only when we actually filled them)
  const cachedBadge = prefillNote ? <span className="ml-2 text-[10px] px-1 py-0.5 rounded bg-yellow-100 text-yellow-800">from cache</span> : null;

  // Show brand/category if enrichment produced values OR user starts typing
  const showBrand = enriching || (newItem?.brand != null && String(newItem.brand).length > 0);
  const showCategory = enriching || (newItem?.category != null && String(newItem.category).length > 0);

  return (
    <form onSubmit={handleSubmit} className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-5">
      <div className="flex items-center gap-2 sm:col-span-5">
        <input
          ref={barcodeInputRef}
          className="rounded border px-2 py-1 w-full"
          placeholder="Barcode / SKU"
          value={newItem?.barcode ?? ""}
          onChange={onChange("barcode")}
          aria-label="Barcode or SKU"
        />
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

      {/* small enrichment status row */}
      <div className="sm:col-span-5" aria-live="polite">
        {enriching ? (
          <p className="text-xs text-gray-500 mt-[-4px] mb-[-2px]">Looking up product details…</p>
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

      {/* ✅ Brand (optional, appears when enrichment/user present) */}
      {showBrand ? (
        <input
          className="rounded border px-2 py-1"
          placeholder="Brand (auto-filled)"
          value={newItem?.brand ?? ""}
          onChange={onChange("brand")}
          aria-label="Brand"
        />
      ) : (
        <div className="hidden sm:block" />
      )}

      {/* ✅ Category (optional, appears when enrichment/user present) */}
      {showCategory ? (
        <input
          className="rounded border px-2 py-1"
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
