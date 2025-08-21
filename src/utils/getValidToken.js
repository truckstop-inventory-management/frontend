// src/utils/getValidToken.js
export async function getValidToken() {
  let token = localStorage.getItem("token");

  if (token) return token;

  // No token? Try to generate one automatically (if you allow guest/auto login)
  // OR redirect to login form

  // Example: auto-login with a fixed service account (if supported by backend)
  try {
    const res = await fetch("https://backend-nlxq.onrender.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: import.meta.env.VITE_DEFAULT_USER,
        password: import.meta.env.VITE_DEFAULT_PASS,
      }),
    });

    if (!res.ok) {
      throw new Error("Failed to auto-generate token");
    }

    const data = await res.json();
    localStorage.setItem("token", data.token);
    return data.token;
  } catch (err) {
    console.error("[Auth] Unable to auto-generate token:", err);
    throw err;
  }
}
