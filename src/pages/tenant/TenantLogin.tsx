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
  placeholder: '#444',
  font: '"Geist", system-ui, -apple-system, sans-serif',
}

export default function TenantLogin({ onNavigate }: TenantLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusEmail, setFocusEmail] = useState(false);
  const [focusPass, setFocusPass] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
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
      if (!res.ok) {
        setError(d.error || 'Ошибка входа. Проверьте данные.');
        return;
      }
      localStorage.setItem(
        'tenant_session',
        JSON.stringify({ tenantId: d.tenantId, token: d.sessionToken, email: d.email })
      );
      onNavigate('home');
    } catch {
      setError('Не удалось подключиться к серверу.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (focused: boolean): React.CSSProperties => ({
    width: '100%',
    padding: '10px 12px',
    background: focused ? '#161616' : '#0f0f0f',
    border: `1px solid ${focused ? '#444' : C.border}`,
    borderRadius: 6,
    fontSize: 14,
    color: C.text,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: C.font,
    transition: 'border-color .15s, background .15s',
  });

  return (
    <div style={{
      background: C.bg,
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: C.font,
      padding: '0 16px',
    }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img
            src="https://mayak-d.ru/pics/logo.png"
            alt="Маяк"
            style={{ height: 36, display: 'block', margin: '0 auto 20px', filter: 'brightness(0) invert(1)' }}
          />
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 6px', color: C.text, letterSpacing: '-0.3px' }}>
            Портал арендатора
          </h1>
          <p style={{ color: C.muted, margin: 0, fontSize: 13 }}>
            Бизнес-центр «Маяк», Дмитров
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: 28,
        }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: C.text }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onFocus={() => setFocusEmail(true)}
                onBlur={() => setFocusEmail(false)}
                placeholder="you@company.ru"
                required
                style={inputStyle(focusEmail)}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: C.text }}>
                Пароль
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onFocus={() => setFocusPass(true)}
                onBlur={() => setFocusPass(false)}
                placeholder="••••••••"
                required
                style={inputStyle(focusPass)}
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(255,68,68,0.08)',
                border: '1px solid rgba(255,68,68,0.2)',
                borderRadius: 6,
                padding: '10px 12px',
                fontSize: 13,
                color: '#ff6b6b',
                marginBottom: 16,
              }}>{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: loading ? '#333' : '#fff',
                color: '#000',
                border: 'none',
                borderRadius: 6,
                padding: '10px',
                fontSize: 14,
                fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: C.font,
                transition: 'background .15s',
                letterSpacing: '-0.1px',
              }}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#e5e5e5' }}
              onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#fff' }}
            >
              {loading ? 'Входим...' : 'Войти'}
            </button>
          </form>
        </div>

        <p style={{ color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 20, lineHeight: 1.5 }}>
          Забыли пароль? Обратитесь к администратору
        </p>
      </div>
    </div>
  );
}
