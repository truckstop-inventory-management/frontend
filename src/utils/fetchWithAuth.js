// src/utils/fetchWithAuth.js
export async function fetchWithAuth(url, options = {}) {
  const token = localStorage.getItem("token");

  if (!token) {
    throw new Error("No JWT token found. Please log in again.");
  }

  const headers = {
    ...options.headers,
    Authorization: `Bearer ${token}`,
  };

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    console.warn("[Auth] Token expired or invalid. Clearing token.");
    localStorage.removeItem("token");
    throw new Error("Unauthorized. Please log in again.");
  }

  return res;
}
