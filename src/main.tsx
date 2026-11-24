import './index.css'
import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'

// Это приложение обслуживает внутренние разделы:
//   /*         система управления зданием (админка)
//   /tenant/*  личный кабинет арендатора
// Публичный сайт mayak-d.ru — отдельное приложение в apps/site (Next.js).
const AdminApp  = lazy(() => import('./App.tsx'))
const TenantApp = lazy(() => import('./TenantApp.tsx'))

const path = window.location.pathname
const root = createRoot(document.getElementById('root')!)

const loader = (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: 'var(--text-3)' }}>
    Загрузка…
  </div>
)

root.render(
  <StrictMode>
    <Suspense fallback={loader}>
      {path === '/tenant' || path.startsWith('/tenant/') ? <TenantApp /> : <AdminApp />}
    </Suspense>
  </StrictMode>,
)
