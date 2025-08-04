const BASE_URL = 'https://backend-nlxq.onrender.com/api';

// Helper to create headers with token
function getAuthHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

// Fetch all inventory items
export async function fetchInventory(token) {
  const response = await fetch(`${BASE_URL}/inventory`, {
    headers: getAuthHeaders(token)
  });
  if (!response.ok) throw new Error('Failed to fetch inventory');
  return response.json();
}

// Create new inventory item
export async function createInventoryItem(token, itemData) {
  const response = await fetch(`${BASE_URL}/inventory`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(itemData),
  });
  if (!response.ok) throw new Error('Failed to create inventory item');
  return response.json();
}

// Fetch single inventory item by id
export async function fetchInventoryItem(token, id) {
  const response = await fetch(`${BASE_URL}/inventory/${id}`, {
    headers: getAuthHeaders(token)
  });
  if (!response.ok) throw new Error('Failed to fetch item');
  return response.json();
}

// Update inventory item
export async function updateInventoryItem(token, id, updatedData) {
  const response = await fetch(`${BASE_URL}/inventory/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(token),
    body: JSON.stringify(updatedData),
  });
  if (!response.ok) throw new Error('Failed to update item');
  return response.json();
}

// Delete inventory item
export async function deleteInventoryItem(token, id) {
  const response = await fetch(`${BASE_URL}/inventory/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(token)
  });
  if (!response.ok) throw new Error('Failed to delete item');
  return response.json();
}