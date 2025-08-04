const BASE_URL = 'https://backend-nlxq.onrender.com/api';

// Get token from localStorage
function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Fetch inventory list with auth header
export async function fetchInventory() {
  const response = await fetch(`${BASE_URL}/inventory`, {
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
  });
  if (!response.ok) throw new Error('Failed to fetch inventory');
  return response.json();
}

// Similarly update create, fetch one, update, delete with auth header

export async function createInventoryItem(itemData) {
  const response = await fetch(`${BASE_URL}/inventory`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(itemData),
  });
  if (!response.ok) throw new Error('Failed to create inventory item');
  return response.json();
}

export async function fetchInventoryItem(id) {
  const response = await fetch(`${BASE_URL}/inventory/${id}`, {
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
  });
  if (!response.ok) throw new Error('Failed to fetch item');
  return response.json();
}

export async function updateInventoryItem(id, updatedData) {
  const response = await fetch(`${BASE_URL}/inventory/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(updatedData),
  });
  if (!response.ok) throw new Error('Failed to update item');
  return response.json();
}

export async function deleteInventoryItem(id) {
  const response = await fetch(`${BASE_URL}/inventory/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to delete item');
  return response.json();
}