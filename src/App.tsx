import React from 'react';
import { Dashboard } from './components/Dashboard';
import { useTabSync } from './hooks/useTabSync';
import './index.css';

function App() {
  useTabSync();
  return <Dashboard />;
}

export default App;
