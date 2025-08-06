import React, { useState, useEffect } from 'react';
import { initDB } from './utils/db';
import LoginForm from './components/LoginForm.jsx';
import RegisterForm from './components/RegisterForm.jsx';
import InventoryList from './components/InventoryList.jsx';

export default function App() {
  const [token, setToken] = useState(null);
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    const setup = async () => {
      await initDB();
      console.log("✅ IndexedDB initialized successfully");
      setDbReady(true);
    };
    setup();

    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      console.log("🔑 Token restored from localStorage");
      setToken(savedToken);
      console.log("🔑 Current Token: ", savedToken);
    }
  }, []);

  if (!dbReady) return <p>Initializing database...</p>; // 🚧 Wait before rendering InventoryList

  if (token) {
    return (
      <div>
        <button onClick={() => { setToken(null); localStorage.removeItem('token'); }}>Logout</button>
        <InventoryList token={token} dbReady={dbReady} /> {/* Pass dbReady */}
      </div>
    );
  }

  return (
    <div>
      <LoginForm onLogin={(jwtToken) => { setToken(jwtToken); localStorage.setItem('token', jwtToken); }} />
    </div>
  );
}