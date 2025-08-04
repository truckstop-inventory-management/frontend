import React, { useState, useEffect } from 'react';
import LoginForm from './components/LoginForm.jsx';
import InventoryList from './components/InventoryList.jsx';

export default function App() {
  const [token, setToken] = useState(null);

  // On mount, try to restore token from localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) setToken(savedToken);
  }, []);

  // Login handler sets token state and stores token locally
  const handleLogin = (jwtToken) => {
    setToken(jwtToken);
    localStorage.setItem('token', jwtToken);
  };

  // Logout helper (optional)
  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('token');
  };

  if (!token) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <div>
      <button onClick={handleLogout}>Logout</button>
      <InventoryList token={token} />
    </div>
  );
}