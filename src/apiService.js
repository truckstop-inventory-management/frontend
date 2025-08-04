const BASE_URL = 'https://backend-nlxq.onrender.com/api';

const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4OTBiMDZmZTc5MWEyMTg2ODM0MWRkNCIsImlhdCI6MTc1NDMxNzc1MywiZXhwIjoxNzU2OTA5NzUzfQ.EleFp1A4YfWeoDIxpPVHbuXHZxth8TubndHDTC6lNkI";

// Helper function for GET requests
export async function fetchInventory() {
  const response = await fetch(`${BASE_URL}/inventory`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) throw new Error('Failed to fetch inventory');
  return response.json();
}

// Helper function for POST requests (create)
export async function createInventoryItem(itemData) {
  const response = await fetch(`${BASE_URL}/inventory`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(itemData),
  });
  if (!response.ok) throw new Error('Failed to create inventory item');
  return response.json();
}

// Helper function for GET by ID (read one)
export async function fetchInventoryItem(id) {
  const response = await fetch(`${BASE_URL}/inventory/${id}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) throw new Error('Failed to fetch item');
  return response.json();
}

// Helper function for PUT requests (update)
export async function updateInventoryItem(id, updatedData) {
  const response = await fetch(`${BASE_URL}/inventory/${id}`, {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(updatedData),
  });
  if (!response.ok) throw new Error('Failed to update item');
  return response.json();
}

// Helper function for DELETE requests
export async function deleteInventoryItem(id) {
  const response = await fetch(`${BASE_URL}/inventory/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) throw new Error('Failed to delete item');
  return response.json();
}