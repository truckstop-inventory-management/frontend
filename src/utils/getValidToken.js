// src/utils/getValidToken.js
export async function getValidToken() {
  // 1) Reuse any existing token
  let token = localStorage.getItem("token");
  if (token) return token;

  // 2) Ensure default creds are available for auto-login
  const user = import.meta.env.VITE_DEFAULT_USER;
  const pass = import.meta.env.VITE_DEFAULT_PASS;

  if (!user || !pass) {
    const msg =
      "[Auth] Missing VITE_DEFAULT_USER and/or VITE_DEFAULT_PASS. " +
      "Set these env vars for auto-login or route the user to a login UI.";
    console.error(msg);
    throw new Error(msg); // same outward behavior: still throws when auto-login isn't possible
  }

  // 3) Attempt auto-login (same endpoint as before)
  try {
    const res = await fetch("https://backend-nlxq.onrender.com/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user, password: pass }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `[Auth] Failed to auto-generate token: HTTP ${res.status} ${res.statusText}. ` +
        `BodyStart="${(body || "").slice(0, 160)}"`
      );
    }

    const data = await res.json();
    if (!data?.token) {
      throw new Error("[Auth] Login response missing 'token' field.");
    }

    // 4) Persist token (additive: also store issued-at for future observability)
    localStorage.setItem("token", data.token);
    try {
      localStorage.setItem("token_issued_at", String(Date.now()));
    } catch {
      // non-fatal
    }
    return data.token;
  } catch (err) {
    console.error("[Auth] Unable to auto-generate token:", err);
    throw err; // preserve throw behavior
  }
}
