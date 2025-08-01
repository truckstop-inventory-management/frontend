// src/apiService.js

const BASE_URL = 'https://backend-nlxq.onrender.com/api';

// Helper function for GET requests
export async function fetchInventory() {
  const response = await fetch(`${BASE_URL}/inventory`);
  if (!response.ok) throw new Error('Failed to fetch inventory');
  return response.json();
}

// Helper function for POST requests (create)
export async function createInventoryItem(itemData) {
  const response = await fetch(`${BASE_URL}/inventory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(itemData),
  });
  if (!response.ok) throw new Error('Failed to create inventory item');
  return response.json();
}

// Helper function for GET by ID (read one)
export async function fetchInventoryItem(id) {
  const response = await fetch(`${BASE_URL}/inventory/${id}`);
  if (!response.ok) throw new Error('Failed to fetch item');
  return response.json();
}

// Helper function for PUT requests (update)
export async function updateInventoryItem(id, updatedData) {
  const response = await fetch(`${BASE_URL}/inventory/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatedData),
  });
  if (!response.ok) throw new Error('Failed to update item');
  return response.json();
}

// Helper function for DELETE requests
export async function deleteInventoryItem(id) {
  const response = await fetch(`${BASE_URL}/inventory/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete item');
  return response.json();
}