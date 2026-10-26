import { createRoot } from 'react-dom/client';
import { useEffect } from 'react';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

function AppMountSignal() {
  useEffect(() => {
    window.dispatchEvent(new Event('nura-app-mounted'));
  }, []);
  return null;
}

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    if (import.meta.env.DEV) console.error(error, errorInfo.componentStack);
  },
}).render(
  <>
    <AppMountSignal />
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </>,
);
