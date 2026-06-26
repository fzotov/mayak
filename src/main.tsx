import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import TenantApp from './TenantApp.tsx'

const path = window.location.pathname
const root = createRoot(document.getElementById('root')!)

if (path.startsWith('/tenant')) {
  root.render(<StrictMode><TenantApp /></StrictMode>)
} else {
  root.render(<StrictMode><App /></StrictMode>)
}
