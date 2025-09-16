// src/hooks/useAddItem.js
import { useState } from "react";
import { addItem } from "../utils/db.js";

/**
 * Provides newItem state + a handler to add it to DB and reset.
 * Call addNewItem() and then append returned item to your list.
 */
export default function useAddItem() {
  const [newItem, setNewItem] = useState({
    itemName: "",
    quantity: 0,
    price: "",
    location: "C-Store",
  });

  const addNewItem = async () => {
    if (!newItem.itemName.trim()) return null;
    const added = await addItem(newItem);
    setNewItem({ itemName: "", quantity: 0, price: "", location: "C-Store" });
    return added;
  };

  return { newItem, setNewItem, addNewItem };
}
