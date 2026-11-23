import { useState } from 'react'
import { supabase } from '../lib/supabase'

const inp: React.CSSProperties = {
  width: '100%', padding: '11px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 16,
  fontFamily: 'inherit', outline: 'none', marginBottom: 14, boxSizing: 'border-box', color: '#111',
}
const lbl: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }

/** Вход сотрудников. Регистрации нет: доступ выдаёт владелец приглашением. */
export function AuthPage({ onLogin, denied }: { onLogin: () => void; denied?: boolean }) {
  const [mode, setMode] = useState<'login' | 'reset'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(denied ? 'У этой учётной записи нет доступа в систему управления.' : '')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(''); setMessage('')
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) setError('Неверный email или пароль')
      else onLogin()
    } else {
      await fetch('/api/request-password-reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }).catch(() => {})
      setMessage('Если такой адрес есть в системе, на него отправлена ссылка для смены пароля. Она действует 2 часа.')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f6f7f9', padding: 16, boxSizing: 'border-box' }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: '36px 32px', width: '100%', maxWidth: 380, border: '1px solid #e5e7eb', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <img src="/mayak-logo.png" alt="" style={{ width: 40, height: 40, borderRadius: 9, objectFit: 'cover' }} />
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#111', letterSpacing: '-0.2px' }}>Маяк</div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>Управление бизнес-центром</div>
          </div>
        </div>

        <form onSubmit={submit}>
          <label style={lbl}>Email</label>
          <input style={inp} type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
          {mode === 'login' && <>
            <label style={lbl}>Пароль</label>
            <input style={{ ...inp, marginBottom: 20 }} type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
          </>}
          {error && <div style={{ fontSize: 13, color: '#b91c1c', marginBottom: 14, padding: '9px 12px', background: '#fef2f2', borderRadius: 8 }}>{error}</div>}
          {message && <div style={{ fontSize: 13, color: '#166534', marginBottom: 14, padding: '9px 12px', background: '#f0fdf4', borderRadius: 8, lineHeight: 1.5 }}>{message}</div>}
          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: 12, background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 500, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Отправить ссылку'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <button onClick={() => { setMode(mode === 'login' ? 'reset' : 'login'); setError(''); setMessage('') }}
            style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>
            {mode === 'login' ? 'Забыли пароль?' : 'Вернуться ко входу'}
          </button>
        </div>
        <div style={{ textAlign: 'center', marginTop: 22, paddingTop: 18, borderTop: '1px solid #f0f0f0', fontSize: 13, color: '#9ca3af' }}>
          Арендатор? <a href="/tenant/login" style={{ color: '#374151' }}>Кабинет арендатора</a>
        </div>
      </div>
    </div>
  )
}
