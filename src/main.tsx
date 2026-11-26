import './index.css'
import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { registerServiceWorker } from './lib/pwa'
import { DialogHost } from './components/Dialogs'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/query'

registerServiceWorker()

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
    <QueryClientProvider client={queryClient}>
    <Suspense fallback={loader}>
      {path === '/tenant' || path.startsWith('/tenant/') ? <TenantApp /> : <AdminApp />}
    </Suspense>
    <DialogHost />
    </QueryClientProvider>
  </StrictMode>,
)
