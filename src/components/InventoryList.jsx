import React, { useEffect, useState } from 'react';
import { fetchInventory, createInventoryItem, deleteInventoryItem, updateInventoryItem } from '../apiService.js';
import InventoryForm from './InventoryForm.jsx';

export default function InventoryList({ token }) {  // accept token prop
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    itemName: '',
    quantity: 0,
    price: 0,
    location: '',
  });

  useEffect(() => {
    async function loadInventory() {
      try {
        const data = await fetchInventory(token);  // pass token here
        setItems(data);
      } catch (err) {
        setError(err.message);
      }
    }
    if (token) loadInventory();  // only load if token exists
  }, [token]);

  const handleAddItem = async (newItem) => {
    try {
      const createdItem = await createInventoryItem(token, newItem);  // pass token here
      setItems(prev => [...prev, createdItem]);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteItem = async (id) => {
    try {
      await deleteInventoryItem(token, id);  // pass token here
      setItems(prev => prev.filter(item => item._id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  const startEditing = (item) => {
    setEditingId(item._id);
    setEditForm({
      itemName: item.itemName,
      quantity: item.quantity,
      price: item.price,
      location: item.location,
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({ itemName: '', quantity: 0, price: 0, location: '' });
  };

  const handleSaveEdit = async (id) => {
    try {
      const updatedItem = await updateInventoryItem(token, id, editForm);  // pass token here
      setItems(prev => prev.map(item => (item._id === id ? updatedItem : item)));
      handleCancelEdit();
    } catch (err) {
      setError(err.message);
    }
  };

  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;

  return (
    <div>
      <h2>Inventory Items</h2>
      <InventoryForm onAdd={handleAddItem} />
      <ul>
        {items.map(item => {
          const isEditing = editingId === item._id;
          return (
            <li key={item._id} style={{ marginBottom: '10px' }}>
              {isEditing ? (
                <>
                  <input
                    type="text"
                    value={editForm.itemName}
                    onChange={e => setEditForm({ ...editForm, itemName: e.target.value })}
                  />
                  <input
                    type="number"
                    value={editForm.quantity}
                    onChange={e => setEditForm({ ...editForm, quantity: Number(e.target.value) })}
                    style={{ width: '60px' }}
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.price}
                    onChange={e => setEditForm({ ...editForm, price: Number(e.target.value) })}
                    style={{ width: '80px' }}
                  />
                  <input
                    type="text"
                    value={editForm.location}
                    onChange={e => setEditForm({ ...editForm, location: e.target.value })}
                  />
                  <button onClick={() => handleSaveEdit(item._id)}>Save</button>
                  <button onClick={handleCancelEdit}>Cancel</button>
                </>
              ) : (
                <>
                  {item.itemName} — Qty: {item.quantity} — Price: ${item.price.toFixed(2)} — Location: {item.location}
                  <button onClick={() => startEditing(item)} style={{ marginLeft: '10px' }}>
                    Edit
                  </button>
                  <button onClick={() => handleDeleteItem(item._id)} style={{ marginLeft: '10px' }}>
                    Delete
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}