import React, { useEffect, useState } from 'react';
import { fetchInventory } from '../apiService.js'; // Adjust path if your apiService.js is elsewhere

export default function InventoryList() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadInventory() {
    try {
        const data = await fetchInventory();
        console.log('Inventory data from backend:', data); // <-- add this
        setItems(data);
    } catch (err) {
        console.error('Error fetching inventory:', err); // <-- add this
        setError(err.message);
      }
    }

    loadInventory();
  
}, []);

  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h2>Inventory Items</h2>
      <ul>
        {items.map(item => (
          <li key={item._id}>
            {item.itemName} — Qty: {item.quantity} — Price: ${item.price}
          </li>
        ))}
      </ul>
    </div>
  );
}