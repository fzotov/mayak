import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { C, Button, Field, Input, Notice } from '../components/ui'

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
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, color: C.text, padding: 16, boxSizing: 'border-box' }}>
      <div style={{ background: C.card, borderRadius: 14, padding: '36px 32px', width: '100%', maxWidth: 380, border: `1px solid ${C.line}`, boxShadow: C.shadow, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <img src="/mayak-logo.png" alt="" style={{ width: 40, height: 40, borderRadius: 9, objectFit: 'cover' }} />
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.2px' }}>Маяк</div>
            <div style={{ fontSize: 13, color: C.muted }}>Управление бизнес-центром</div>
          </div>
        </div>

        <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
          <Field label="Email">
            <Input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required style={{ fontSize: 16, padding: '10px 12px' }} />
          </Field>
          {mode === 'login' && (
            <Field label="Пароль">
              <Input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required style={{ fontSize: 16, padding: '10px 12px' }} />
            </Field>
          )}
          {error && <Notice tone="red">{error}</Notice>}
          {message && <Notice tone="green">{message}</Notice>}
          <Button kind="primary" type="submit" disabled={loading} style={{ width: '100%', padding: 11, fontSize: 15 }}>
            {loading ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Отправить ссылку'}
          </Button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <Button kind="ghost" small onClick={() => { setMode(mode === 'login' ? 'reset' : 'login'); setError(''); setMessage('') }} style={{ color: C.muted, textDecoration: 'underline' }}>
            {mode === 'login' ? 'Забыли пароль?' : 'Вернуться ко входу'}
          </Button>
        </div>
        <div style={{ textAlign: 'center', marginTop: 22, paddingTop: 18, borderTop: `1px solid ${C.line}`, fontSize: 13, color: C.faint }}>
          Арендатор? <a href="/tenant/login" style={{ color: C.accent }}>Кабинет арендатора</a>
        </div>
      </div>
    </div>
  )
}
