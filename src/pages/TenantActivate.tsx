import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

type State = 'loading' | 'valid' | 'expired' | 'done' | 'error'

function hashPassword(password: string): Promise<string> {
  return fetch('/api/tenant-activate-hash', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  }).then(r => r.json()).then(d => d.hash)
}

export default function TenantActivatePage() {
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

  async function activate() {
    setErr('')
    if (pw.length < 8) { setErr('Пароль должен быть не менее 8 символов'); return }
    if (pw !== pw2) { setErr('Пароли не совпадают'); return }
    setSaving(true)

    try {
      const salt = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('')
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
        .update({ password_hash, status: 'active', invite_token: null })
        .eq('id', record.id)

      if (error) { setErr('Ошибка: ' + error.message); setSaving(false); return }
      setState('done')
    } catch (e: any) {
      setErr('Ошибка: ' + e.message)
      setSaving(false)
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '10px 12px',
    border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 15,
    fontFamily: 'Arial, sans-serif', outline: 'none', color: '#111',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f4f4f4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial, sans-serif', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 40, width: '100%', maxWidth: 440, boxShadow: '0 2px 16px rgba(0,0,0,0.10)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src="https://mayak-d.ru/pics/logo.png" alt="Маяк" style={{ maxHeight: 52, maxWidth: 160, marginBottom: 12 }} />
          <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>Портал арендаторов</div>
        </div>

        {state === 'loading' && (
          <div style={{ textAlign: 'center', color: '#888', padding: '20px 0' }}>Проверяем ссылку...</div>
        )}

        {state === 'expired' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔗</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#111', marginBottom: 8 }}>Ссылка недействительна</div>
            <div style={{ fontSize: 14, color: '#666', lineHeight: 1.6 }}>
              Ссылка устарела или уже была использована.<br />
              Запросите новую у администратора.
            </div>
            <div style={{ marginTop: 20, fontSize: 13, color: '#999' }}>
              +7 (916) 763-02-07 | +7 (496) 227-00-44
            </div>
          </div>
        )}

        {state === 'valid' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#111', marginBottom: 6, textAlign: 'center' }}>Создайте пароль</div>
            <div style={{ fontSize: 14, color: '#666', marginBottom: 24, textAlign: 'center' }}>
              Для входа на портал арендатора
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: '#555', display: 'block', marginBottom: 5 }}>Email (логин)</label>
              <input style={{ ...inp, background: '#f9fafb', color: '#888' }} value={record?.email ?? ''} readOnly />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: '#555', display: 'block', marginBottom: 5 }}>Пароль <span style={{ color: '#888' }}>(минимум 8 символов)</span></label>
              <input style={inp} type="password" value={pw} onChange={e => { setPw(e.target.value); setErr('') }} placeholder="Введите пароль" autoFocus />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, color: '#555', display: 'block', marginBottom: 5 }}>Подтверждение пароля</label>
              <input style={inp} type="password" value={pw2} onChange={e => { setPw2(e.target.value); setErr('') }} placeholder="Повторите пароль" />
            </div>

            {err && <div style={{ fontSize: 13, color: '#ef4444', marginBottom: 14, padding: '8px 12px', background: '#fef2f2', borderRadius: 6 }}>{err}</div>}

            <button
              onClick={activate}
              disabled={saving}
              style={{ width: '100%', padding: '13px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Arial, sans-serif', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Сохраняем...' : 'Создать пароль и войти'}
            </button>
          </>
        )}

        {state === 'done' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#111', marginBottom: 8 }}>Пароль установлен!</div>
            <div style={{ fontSize: 14, color: '#666', marginBottom: 24, lineHeight: 1.6 }}>
              Теперь вы можете войти на портал арендатора.
            </div>
            <a
              href="/tenant"
              style={{ display: 'inline-block', padding: '12px 32px', background: '#111', color: '#fff', textDecoration: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600 }}
            >
              Войти на портал
            </a>
          </div>
        )}

        <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #f0f0f0', textAlign: 'center', fontSize: 12, color: '#bbb' }}>
          БЦ «Маяк» · г. Дмитров, мкр. Владимира Махалина, д. 20
        </div>
      </div>
    </div>
  )
}
