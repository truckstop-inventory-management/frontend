const BASE_URL = 'https://backend-nlxq.onrender.com/api';

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4OTBiMDZmZTc5MWEyMTg2ODM0MWRkNCIsImlhdCI6MTc1NDMxNzc1MywiZXhwIjoxNzU2OTA5NzUzfQ.EleFp1A4YfWeoDIxpPVHbuXHZxth8TubndHDTC6lNk';

function getAuthHeaders() {
  return {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json'
  };
}

// Fetch all inventory items
export async function fetchInventory() {
  const response = await fetch(`${BASE_URL}/inventory`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Failed to fetch inventory');
  return response.json();
}

// Create new inventory item
export async function createInventoryItem(itemData) {
  const response = await fetch(`${BASE_URL}/inventory`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(itemData),
  });
  if (!response.ok) throw new Error('Failed to create inventory item');
  return response.json();
}

// Fetch single inventory item by id
export async function fetchInventoryItem(id) {
  const response = await fetch(`${BASE_URL}/inventory/${id}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Failed to fetch item');
  return response.json();
}

// Update inventory item
export async function updateInventoryItem(id, updatedData) {
  const response = await fetch(`${BASE_URL}/inventory/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(updatedData),
  });
  if (!response.ok) throw new Error('Failed to update item');
  return response.json();
}

// Delete inventory item
export async function deleteInventoryItem(id) {
  const response = await fetch(`${BASE_URL}/inventory/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Failed to delete item');
  return response.json();
}