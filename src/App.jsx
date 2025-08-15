// src/App.jsx
import React, { useState, useEffect } from 'react';
import { initDB } from './utils/db';
import LoginForm from './components/LoginForm.jsx';
import InventoryList from './components/InventoryList.jsx';
import OfflineBanner from './components/OfflineBanner.jsx';
import InventoryViewToggle from './components/InventoryViewToggle.jsx';
import { LOCATION } from './utils/location';

export default function App() {
  const [token, setToken] = useState(null);
  const [dbReady, setDbReady] = useState(false);

  // View selection
  const [selectedView, setSelectedView] = useState(LOCATION.C_STORE);
  const STORAGE_KEY = 'inventory.selectedView';

  // Counts from the list (lifted up via callback)
  const [counts, setCounts] = useState({
    [LOCATION.C_STORE]: 0,
    [LOCATION.RESTAURANT]: 0,
  });

  useEffect(() => {
    const setup = async () => {
      await initDB();
      console.log('✅ IndexedDB initialized successfully');
      setDbReady(true);
    };
    setup();

    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      console.log('🔑 Token restored from localStorage');
      setToken(savedToken);
      console.log('🔑 Current Token: ', savedToken);
    }

    const savedView = localStorage.getItem(STORAGE_KEY);
    if (savedView === LOCATION.C_STORE || savedView === LOCATION.RESTAURANT) {
      setSelectedView(savedView);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, selectedView);
  }, [selectedView]);

  if (!dbReady) return <p>Initializing database...</p>;

  if (token) {
    return (
      <div style={{ paddingTop: 48 }}>
        <OfflineBanner token={token} />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '0 16px',
            marginBottom: 12,
            gap: 12,
          }}
        >
          <button
            onClick={() => {
              setToken(null);
              localStorage.removeItem('token');
            }}
          >
            Logout
          </button>

          <InventoryViewToggle
            value={selectedView}
            onChange={setSelectedView}
            counts={counts}
          />
        </div>

        <InventoryList
          token={token}
          dbReady={dbReady}
          locationFilter={selectedView}
          onCountsChange={(c) => setCounts(c)}
        />
      </div>
    );
  }

  return (
    <>
      <OfflineBanner token={token} />
      <div style={{ paddingTop: 48 }}>
        <LoginForm
          onLogin={(jwtToken) => {
            setToken(jwtToken);
            localStorage.setItem('token', jwtToken);
          }}
        />
      </div>
    </>
  );
}