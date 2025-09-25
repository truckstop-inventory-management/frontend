// src/hooks/useAddItem.js
import { useCallback, useState } from "react";
import { addItem } from "../utils/db.js";

const INITIAL = { itemName: "", quantity: "", price: "", location: "C-Store" };

export default function useAddItem() {
  const [newItem, setNewItem] = useState(INITIAL);

  const addNewItem = useCallback(async (payload) => {
    // prefer explicit payload (e.g., from FloatingAddButton), else use current form state
    const src = payload ?? newItem;

    // 🔎 debug: confirm what addNewItem is actually using
    console.log("[addNewItem] payload=", payload, " state=", newItem);

    const itemName = String(src?.itemName || "").trim();
    const quantity = Number.isFinite(Number(src?.quantity)) ? Number(src.quantity) : 0;
    const price    = Number.isFinite(Number(src?.price)) ? Number(src.price) : 0;
    const location = String(src?.location || "C-Store").trim();

    if (!itemName) return null;

    const saved = await addItem({
      itemName,
      quantity,
      price,
      location,
      isDeleted: false,
      syncStatus: "pending",
      // lastUpdated is set in addItem()
    });

    setNewItem(INITIAL);
    return saved;
  }, [newItem]);

  return { newItem, setNewItem, addNewItem };
}
