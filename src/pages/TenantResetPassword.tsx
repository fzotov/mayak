import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

type State = 'loading' | 'valid' | 'expired' | 'done' | 'error'

const C = {
  bg: '#0a0a0a', surface: '#111', border: '#1f1f1f',
  text: '#ededed', muted: '#666',
  font: '"Geist", system-ui, -apple-system, sans-serif',
}

export default function TenantResetPassword() {
  const token = new URLSearchParams(window.location.search).get('token') ?? ''
  const [state, setState] = useState<State>('loading')
  const [record, setRecord] = useState<any>(null)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!token) { setState('expired'); return }
    supabase
      .from('tenant_portal_access')
      .select('*')
      .eq('invite_token', token)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { setState('expired'); return }
        const expired = data.invite_expires_at && new Date(data.invite_expires_at) < new Date()
        if (expired) { setState('expired'); return }
        setRecord(data)
        setState('valid')
      })
  }, [token])

  async function reset() {
    setErr('')
    if (pw.length < 8) { setErr('Пароль должен быть не менее 8 символов'); return }
    if (pw !== pw2) { setErr('Пароли не совпадают'); return }
    setSaving(true)
    try {
      const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0')).join('')
      const enc = new TextEncoder()
      const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits'])
      const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
        keyMaterial, 256
      )
      const hash = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('')
      const password_hash = `${salt}:${hash}`

      const { error } = await supabase
        .from('tenant_portal_access')
        .update({ password_hash, status: 'active', invite_token: null, invite_expires_at: null })
        .eq('id', record.id)

      if (error) { setErr('Ошибка: ' + error.message); setSaving(false); return }
      setState('done')
    } catch (e: any) {
      setErr('Ошибка: ' + e.message)
      setSaving(false)
    }
  }

  const inp = (focused = false): React.CSSProperties => ({
    width: '100%', boxSizing: 'border-box', padding: '10px 12px',
    background: '#0f0f0f', border: `1px solid ${focused ? '#444' : C.border}`,
    borderRadius: 6, fontSize: 14, color: C.text, outline: 'none', fontFamily: C.font,
  })

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: C.font, padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src="/mayak-logo.png" alt="Маяк" style={{ height: 56, display: 'block', margin: '0 auto 16px', borderRadius: 8 }} />
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 28 }}>
          {state === 'loading' && (
            <div style={{ textAlign: 'center', color: C.muted, padding: '20px 0' }}>Проверяем ссылку...</div>
          )}

          {state === 'expired' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🔗</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 8 }}>Ссылка недействительна</div>
              <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 20 }}>
                Ссылка устарела или уже была использована.
              </div>
              <a href="/tenant" style={{ display: 'inline-block', padding: '10px 24px', background: '#fff', color: '#000', textDecoration: 'none', borderRadius: 6, fontSize: 14, fontWeight: 500 }}>
                Вернуться ко входу
              </a>
            </div>
          )}

          {state === 'valid' && (
            <>
              <div style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 4 }}>Новый пароль</div>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>{record?.email}</div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 6 }}>Новый пароль</label>
                <input style={inp()} type="password" value={pw} onChange={e => { setPw(e.target.value); setErr('') }} placeholder="Минимум 8 символов" autoFocus />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 6 }}>Повторите пароль</label>
                <input style={inp()} type="password" value={pw2} onChange={e => { setPw2(e.target.value); setErr('') }} placeholder="Повторите пароль" />
              </div>

              {err && (
                <div style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)', borderRadius: 6, padding: '10px 12px', fontSize: 13, color: '#ff6b6b', marginBottom: 16 }}>
                  {err}
                </div>
              )}

              <button
                onClick={reset}
                disabled={saving}
                style={{ width: '100%', padding: '10px', background: saving ? '#333' : '#fff', color: '#000', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: C.font }}
              >
                {saving ? 'Сохраняем...' : 'Сохранить пароль'}
              </button>
            </>
          )}

          {state === 'done' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 22 }}>✓</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 8 }}>Пароль обновлён</div>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>Теперь вы можете войти с новым паролем.</div>
              <a href="/tenant" style={{ display: 'inline-block', padding: '10px 28px', background: '#fff', color: '#000', textDecoration: 'none', borderRadius: 6, fontSize: 14, fontWeight: 500 }}>
                Войти
              </a>
            </div>
          )}
        </div>

        <p style={{ color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 20 }}>
          БЦ «Маяк» · г. Дмитров
        </p>
      </div>
    </div>
  )
}
