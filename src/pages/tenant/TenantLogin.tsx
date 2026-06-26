import { useState } from 'react';

interface TenantLoginProps {
  onNavigate: (p: string) => void;
}

export default function TenantLogin({ onNavigate }: TenantLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  return (
    <div
      style={{
        background: '#f9fafb',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 400,
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 40,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          background: '#fff',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img
            src="https://mayak-d.ru/pics/logo.png"
            alt="Маяк"
            style={{ maxHeight: 52, display: 'block', margin: '0 auto 16px' }}
          />
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 4px' }}>
            Портал арендатора
          </h2>
          <p style={{ color: '#6b7280', margin: 0, fontSize: 14 }}>
            Бизнес-центр «Маяк»
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
              Пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: '#111',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '12px',
              fontSize: 15,
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Входим...' : 'Войти'}
          </button>

          {error && (
            <p style={{ color: '#ef4444', fontSize: 13, textAlign: 'center', marginTop: 12 }}>
              {error}
            </p>
          )}

          <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', marginTop: 16 }}>
            Забыли пароль? Обратитесь к администратору
          </p>
        </form>
      </div>
    </div>
  );
}
