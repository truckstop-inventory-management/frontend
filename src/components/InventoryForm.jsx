import React, { useState } from 'react';

export default function InventoryForm({ onAdd }) {
    const [successMessage, setSuccessMessage] = useState(null);
    const [itemName, setItemName] = useState('');
    const [quantity, setQuantity] = useState('');
    const [price, setPrice] = useState('');
    const [location, setLocation] = useState('');
    const [error, setError] = useState(null);

    const handleSubmit = (e) => {
    e.preventDefault();

    if (!itemName.trim() || quantity <= 0 || price <= 0 || !location.trim()) {
    setError('Please fill all fields with valid positive values');
    return;
    }
    setError(null);

    onAdd({ itemName, quantity: Number(quantity), price: Number(price), location });
    setSuccessMessage('Item added successfully!');
    setTimeout(() => setSuccessMessage(null), 3000);

    setItemName('');
    setQuantity('');
    setPrice('');
    setLocation('');
    };



  return (
    <form onSubmit={handleSubmit}>
      <h3>Add New Inventory Item</h3>

    {successMessage && <p style={{ color: 'green' }}>{successMessage}</p>}
    {error && <p style={{ color: 'red' }}>{error}</p>}
    
      <input
        type="text"
        placeholder="Item Name"
        value={itemName}
        onChange={(e) => setItemName(e.target.value)}
      />
      <input
        type="number"
        placeholder="Quantity"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
      />
      <input
        type="number"
        placeholder="Price"
        step="0.01"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
      />
      <input
        type="text"
        placeholder="Location"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
      />
      <button type="submit">Add Item</button>
    </form>
  );
}