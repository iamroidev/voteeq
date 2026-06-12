import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

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
