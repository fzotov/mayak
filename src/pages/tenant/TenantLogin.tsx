import { useState } from 'react';

interface TenantLoginProps {
  onNavigate: (p: string) => void;
}

const C = {
  bg: '#0a0a0a',
  surface: '#111',
  border: '#1f1f1f',
  text: '#ededed',
  muted: '#666',
  font: '"Geist", system-ui, -apple-system, sans-serif',
}

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', background: '#0f0f0f',
  border: `1px solid #1f1f1f`, borderRadius: 6, fontSize: 14,
  color: '#ededed', outline: 'none', fontFamily: C.font, boxSizing: 'border-box',
}

export default function TenantLogin({ onNavigate }: TenantLoginProps) {
  const [mode, setMode] = useState<'login' | 'reset'>('login');

  // Login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset state
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/tenant-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'Ошибка входа. Проверьте данные.'); return; }
      localStorage.setItem('tenant_session', JSON.stringify({ tenantId: d.tenantId, token: d.sessionToken, email: d.email }));
      onNavigate('home');
    } catch {
      setError('Не удалось подключиться к серверу.');
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setResetLoading(true);
    try {
      await fetch('/api/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      });
      setResetSent(true);
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: C.font, padding: '0 16px' }}>
      <div style={{ width: '100%', maxWidth: 360 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/mayak-logo.png" alt="Маяк" style={{ height: 64, display: 'block', margin: '0 auto 20px', borderRadius: 10 }} />
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 6px', color: C.text, letterSpacing: '-0.3px' }}>
            {mode === 'reset' ? 'Восстановление пароля' : 'Портал арендатора'}
          </h1>
          <p style={{ color: C.muted, margin: 0, fontSize: 13 }}>Бизнес-центр «Маяк», Дмитров</p>
        </div>

        {/* Login */}
        {mode === 'login' && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 28 }}>
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: C.text }}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.ru" required style={inp} />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: C.text }}>Пароль</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required style={inp} />
              </div>
              {error && (
                <div style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)', borderRadius: 6, padding: '10px 12px', fontSize: 13, color: '#ff6b6b', marginBottom: 16 }}>
                  {error}
                </div>
              )}
              <button type="submit" disabled={loading} style={{ width: '100%', background: loading ? '#333' : '#fff', color: '#000', border: 'none', borderRadius: 6, padding: '10px', fontSize: 14, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: C.font }}>
                {loading ? 'Входим...' : 'Войти'}
              </button>
            </form>
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <button onClick={() => { setMode('reset'); setError(''); }} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 12, cursor: 'pointer', textDecoration: 'underline', fontFamily: C.font, padding: 0 }}>
                Забыли пароль?
              </button>
            </div>
          </div>
        )}

        {/* Reset password */}
        {mode === 'reset' && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 28 }}>
            {resetSent ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 20, color: '#22c55e' }}>✓</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 8 }}>Письмо отправлено</div>
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 20 }}>
                  Если аккаунт с таким email существует — вы получите ссылку для сброса пароля. Ссылка действительна 2 часа.
                </div>
                <button onClick={() => { setMode('login'); setResetSent(false); setResetEmail(''); }} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 13, cursor: 'pointer', textDecoration: 'underline', fontFamily: C.font }}>
                  Вернуться ко входу
                </button>
              </div>
            ) : (
              <form onSubmit={handleReset}>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 20, lineHeight: 1.5 }}>
                  Введите email аккаунта — пришлём ссылку для сброса пароля.
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 6 }}>Email</label>
                  <input type="email" required value={resetEmail} onChange={e => setResetEmail(e.target.value)} placeholder="you@company.ru" style={inp} />
                </div>
                <button type="submit" disabled={resetLoading} style={{ width: '100%', padding: '10px', background: resetLoading ? '#333' : '#fff', color: '#000', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: resetLoading ? 'not-allowed' : 'pointer', fontFamily: C.font, marginBottom: 14 }}>
                  {resetLoading ? 'Отправляем...' : 'Отправить ссылку'}
                </button>
                <div style={{ textAlign: 'center' }}>
                  <button type="button" onClick={() => setMode('login')} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 13, cursor: 'pointer', textDecoration: 'underline', fontFamily: C.font }}>
                    Вернуться ко входу
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
