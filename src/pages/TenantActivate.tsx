import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

type State = 'loading' | 'valid' | 'expired' | 'done'

const C = { bg: 'var(--bg)', surface: 'var(--surface)', border: 'var(--border)', text: 'var(--text)', muted: 'var(--text-2)', font: '"Geist", system-ui, -apple-system, sans-serif' }
const inp: React.CSSProperties = {
  width: '100%', padding: '12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
  fontSize: 16, color: 'var(--text)', outline: 'none', fontFamily: C.font, boxSizing: 'border-box',
}

/** Задать пароль по одноразовой ссылке из письма: приглашение арендатора, приглашение сотрудника, сброс пароля. */
export default function SetPasswordPage({ mode = 'activate' }: { mode?: 'activate' | 'reset' }) {
  const token = new URLSearchParams(window.location.search).get('token') ?? ''
  const [state, setState] = useState<State>('loading')
  const [email, setEmail] = useState('')
  const [kind, setKind] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!token) { setState('expired'); return }
    fetch('/api/set-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, check: true }) })
      .then(r => r.json())
      .then(d => { if (d.ok) { setEmail(d.email); setKind(d.kind); setState('valid') } else setState('expired') })
      .catch(() => setState('expired'))
  }, [token])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    if (pw.length < 8) { setErr('Пароль должен быть не короче 8 символов'); return }
    if (pw !== pw2) { setErr('Пароли не совпадают'); return }
    setSaving(true)
    try {
      const r = await fetch('/api/set-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password: pw }) })
      const d = await r.json()
      if (!d.ok) { setErr(d.error || 'Не удалось сохранить пароль'); setSaving(false); return }
      const { error } = await supabase.auth.signInWithPassword({ email: d.email, password: pw })
      if (error) { setState('done'); return }
      window.location.replace(d.area === 'staff' ? '/' : '/tenant/dashboard')
    } catch {
      setErr('Не удалось подключиться к серверу'); setSaving(false)
    }
  }

  const title = state === 'expired' ? 'Ссылка недействительна'
    : state === 'done' ? 'Пароль сохранён'
    : mode === 'reset' || kind === 'reset' ? 'Новый пароль' : 'Создайте пароль'

  return (
    <div style={{ background: C.bg, minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: C.font, padding: '24px 16px', boxSizing: 'border-box' }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src="/mayak-logo.png" alt="Маяк" style={{ height: 64, display: 'block', margin: '0 auto 20px', borderRadius: 10 }} />
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 6px', color: C.text, letterSpacing: '-0.3px' }}>{title}</h1>
          <p style={{ color: C.muted, margin: 0, fontSize: 13 }}>Бизнес-центр «Маяк», Дмитров</p>
        </div>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24 }}>
          {state === 'loading' && <div style={{ color: C.muted, fontSize: 14, textAlign: 'center' }}>Проверяем ссылку…</div>}

          {state === 'expired' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: C.muted, fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
                Ссылка уже использована или её срок истёк. Запросите новую на странице входа или обратитесь в администрацию бизнес-центра.
              </div>
              <a href="/tenant/login" style={{ display: 'block', background: 'var(--text)', color: 'var(--bg)', borderRadius: 8, padding: 12, fontSize: 15, fontWeight: 500, textDecoration: 'none' }}>Перейти ко входу</a>
            </div>
          )}

          {state === 'done' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: C.muted, fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>Теперь войдите с новым паролем.</div>
              <a href="/tenant/login" style={{ display: 'block', background: 'var(--text)', color: 'var(--bg)', borderRadius: 8, padding: 12, fontSize: 15, fontWeight: 500, textDecoration: 'none' }}>Войти</a>
            </div>
          )}

          {state === 'valid' && (
            <form onSubmit={submit}>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 18, lineHeight: 1.5 }}>Аккаунт: <span style={{ color: C.text }}>{email}</span></div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: C.text }}>Пароль</label>
              <input type="password" autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Не короче 8 символов" required style={{ ...inp, marginBottom: 14 }} />
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: C.text }}>Пароль ещё раз</label>
              <input type="password" autoComplete="new-password" value={pw2} onChange={e => setPw2(e.target.value)} required style={{ ...inp, marginBottom: 20 }} />
              {err && <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--red)', marginBottom: 16 }}>{err}</div>}
              <button type="submit" disabled={saving} style={{ width: '100%', background: saving ? 'var(--border-strong)' : 'var(--text)', color: 'var(--bg)', border: 'none', borderRadius: 8, padding: 12, fontSize: 15, fontWeight: 500, cursor: saving ? 'default' : 'pointer', fontFamily: C.font }}>
                {saving ? 'Сохраняем…' : 'Сохранить и войти'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
