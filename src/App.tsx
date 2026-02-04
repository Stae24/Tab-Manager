import React from 'react';
import { Dashboard } from './components/Dashboard';
import { useTabSync } from './hooks/useTabSync';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

function App() {
  useTabSync();
  return (
    <ErrorBoundary name="Neural Workspace">
      <Dashboard />
    </ErrorBoundary>
  );
}


export default App;
