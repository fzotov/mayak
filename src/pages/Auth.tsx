import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function AuthPage({ onLogin }: { onLogin: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const inp: React.CSSProperties = {
    width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb',
    borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none',
    marginBottom: 12
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(''); setMessage('')
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else onLogin()
    } else {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: name } }
      })
      if (error) setError(error.message)
      else setMessage('Check your email to confirm your account!')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f8', fontFamily: '-apple-system,sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 40, width: 380, border: '1px solid #e8ebf3' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#4f6ef7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#fff' }}>М</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#1a2240' }}>Маяк</div>
            <div style={{ fontSize: 11, color: '#8596b4' }}>Property OS</div>
          </div>
        </div>

        <div style={{ display: 'flex', background: '#f0f2f8', borderRadius: 8, padding: 3, marginBottom: 24, gap: 3 }}>
          {(['login', 'register'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              style={{ flex: 1, padding: '7px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
                background: mode === m ? '#fff' : 'transparent',
                color: mode === m ? '#1a2240' : '#8596b4' }}>
              {m === 'login' ? 'Войти' : 'Регистрация'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 5 }}>Имя</label>
              <input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="Иван Иванов" required />
            </>
          )}
          <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 5 }}>Email</label>
          <input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" required />
          <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 5 }}>Пароль</label>
          <input style={{ ...inp, marginBottom: 20 }} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Минимум 6 символов" required />

          {error && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 12, padding: '8px 12px', background: '#fef2f2', borderRadius: 6 }}>{error}</div>}
          {message && <div style={{ fontSize: 12, color: '#16a34a', marginBottom: 12, padding: '8px 12px', background: '#f0fdf4', borderRadius: 6 }}>{message}</div>}

          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: 11, background: '#4f6ef7', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
            {loading ? 'Загрузка...' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </form>
      </div>
    </div>
  )
}
