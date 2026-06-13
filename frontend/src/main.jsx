import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Handle Vite's dynamic import preload failures (due to new deployment/modified asset hashes)
window.addEventListener('vite:preloadError', (event) => {
  console.warn('Vite preload error detected, reloading page to fetch latest version...', event);
  window.location.reload();
});

// Handle uncaught chunk loading errors
window.addEventListener('error', (event) => {
  const errorMsg = event.message || '';
  if (errorMsg.includes('Failed to fetch dynamically imported module') || errorMsg.includes('chunk') || errorMsg.includes('dynamically imported module')) {
    console.warn('Dynamic import or chunk error detected, reloading page...', errorMsg);
    window.location.reload();
  }
}, true);


// Paystack and other external redirects land on path URLs — map to hash routes before React boots
const legacyPath = window.location.pathname.replace(/\/$/, '')
if (legacyPath === '/payment-status') {
  const query = window.location.search || ''
  window.location.replace(`${window.location.origin}/#/payment-status${query}`)
} else if (legacyPath === '/admin') {
  window.location.replace(`${window.location.origin}/#/admin`)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
