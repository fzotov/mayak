import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import SiteApp from './site/SiteApp.tsx'

// Один деплой — три приложения:
//   /            публичный сайт mayak-d.ru
//   /tenant/*    личный кабинет арендатора
//   /admin/*     система управления зданием
// Кабинет и админка грузятся отдельными чанками, чтобы сайт открывался мгновенно.
const AdminApp  = lazy(() => import('./App.tsx'))
const TenantApp = lazy(() => import('./TenantApp.tsx'))

const path = window.location.pathname
const root = createRoot(document.getElementById('root')!)

const loader = (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: '#8596b4' }}>
    Загрузка…
  </div>
)

const app = path.startsWith('/tenant') ? <Suspense fallback={loader}><TenantApp /></Suspense>
  : path.startsWith('/admin')          ? <Suspense fallback={loader}><AdminApp /></Suspense>
  : <SiteApp />

root.render(<StrictMode>{app}</StrictMode>)
