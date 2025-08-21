import React, { useState } from 'react';

export default function NewItemModel({ onClose, onSave}) {
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(0);
  const [location, setLocation] = useState("");

  const handleSubmit = () => {

    if(!itemName.trim()) {
      return;
    }

    const newItem = {
      _id: `local_${Date.now()}`,
      name: itemName,
      quantity: Number(quantity),
      price: Number(price),
      location: location,
      syncStatus: "pending",
      isDeleted: false,
      lastUpdated: new Date().toISOString()
    };

    onSave(newItem);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg p-6 w-80">
        <h2 className="text-lg font-bold mb-4">Add New Item</h2>

        <input
          type="text"
          placeholder="Item Name"
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          className="border p-2 w-full mb-3 rounded"
        />

        <input
          type="number"
          placeholder="Quantity"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="border p-2 w-full mb-3 rounded"
        />

        <input
          type="number"
          placeholder="Price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="border p-2 w-full mb-3 rounded"
        />

        <select
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="border p-2 w-full mb-3 rounded"
        >
          <option value="C-Store">C-Store</option>
          <option value="Restaurant">Restaurant</option>
        </select>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}