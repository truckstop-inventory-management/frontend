import React, { useState, useEffect } from 'react';
import LoginForm from './components/LoginForm.jsx';
import RegisterForm from './components/RegisterForm.jsx';
import InventoryList from './components/InventoryList.jsx';

export default function App() {
  const [token, setToken] = useState(null);
  const [showRegister, setShowRegister] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) setToken(savedToken);
  }, []);

  const handleLogin = (jwtToken) => {
    setToken(jwtToken);
    localStorage.setItem('token', jwtToken);
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('token');
  };

  // Show Inventory if logged in
  if (token) {
    return (
      <div>
        <button onClick={handleLogout}>Logout</button>
        <InventoryList token={token} />
      </div>
    );
  }

  // Show Register or Login form
  return (
    <div>
      {showRegister ? (
        <>
          <RegisterForm onRegister={() => setShowRegister(false)} />
          <p>
            Already have an account?{' '}
            <button onClick={() => setShowRegister(false)}>Login</button>
          </p>
        </>
      ) : (
        <>
          <LoginForm onLogin={handleLogin} />
          <p>
            Don't have an account?{' '}
            <button onClick={() => setShowRegister(true)}>Register</button>
          </p>
        </>
      )}
    </div>
  );
}