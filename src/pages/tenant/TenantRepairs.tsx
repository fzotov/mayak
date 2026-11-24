import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { apiFetch } from '../../lib/api'
import { T, Card, Title, Badge, Button, Loading, Empty, Note, input, label, date, page } from './ui'

const CATEGORIES = ['Электрика', 'Сантехника', 'Отопление', 'Интернет', 'Уборка', 'Другое']
const STATUS: Record<string, { t: string; tone: 'ok' | 'warn' | 'bad' | 'muted' }> = {
  new: { t: 'новая', tone: 'muted' }, accepted: { t: 'принята', tone: 'warn' }, in_progress: { t: 'в работе', tone: 'warn' },
  completed: { t: 'выполнена', tone: 'ok' }, rejected: { t: 'отклонена', tone: 'bad' },
}

export default function TenantRepairs({ tenantId }: { tenantId: string }) {
  const [items, setItems] = useState<any[] | null>(null)
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState(CATEGORIES[0])
  const [text, setText] = useState('')
  const [urgent, setUrgent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const load = () => supabase.from('repairs').select('id,number,category,priority,status,description,comment,created_at,completed_date').eq('tenant_id', tenantId)
    .order('created_at', { ascending: false }).then(({ data }) => setItems(data || []))
  useEffect(() => { load() }, [tenantId])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (text.trim().length < 5) { setErr('Опишите проблему подробнее'); return }
    setBusy(true); setErr('')
    const r = await apiFetch('/api/tenant-repair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category, description: text, urgent }) })
    const d = await r.json().catch(() => ({ ok: false }))
    setBusy(false)
    if (!d.ok) { setErr(d.error || 'Не удалось отправить заявку. Попробуйте ещё раз или позвоните: +7 (916) 763-02-07'); return }
    setText(''); setUrgent(false); setOpen(false); load()
  }

  if (!items) return <Loading />
  return (
    <div style={page}>
      {!open && <Button onClick={() => setOpen(true)} full>Новая заявка</Button>}
      {open && (
        <Card>
          <Title>Новая заявка</Title>
          <form onSubmit={submit}>
            <label style={label}>Что случилось</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {CATEGORIES.map(c => (
                <button type="button" key={c} onClick={() => setCategory(c)} style={{ minHeight: 40, padding: '0 14px', borderRadius: 20, fontSize: 14, fontFamily: T.font, cursor: 'pointer', border: `1px solid ${category === c ? T.accent : T.border}`, background: category === c ? T.accent : 'transparent', color: category === c ? 'var(--bg)' : T.text }}>{c}</button>
              ))}
            </div>
            <label style={label}>Описание</label>
            <textarea style={{ ...input, minHeight: 110, resize: 'vertical' }} value={text} onChange={e => setText(e.target.value)} placeholder="Например: не работает розетка у окна" />
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0', fontSize: 14, color: T.text, cursor: 'pointer' }}>
              <input type="checkbox" checked={urgent} onChange={e => setUrgent(e.target.checked)} style={{ width: 20, height: 20 }} />
              Авария: течёт вода, нет света, запах гари
            </label>
            {err && <Note>{err}</Note>}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <Button kind="ghost" onClick={() => setOpen(false)}>Отмена</Button>
              <div style={{ flex: 1 }}><Button type="submit" disabled={busy} full>{busy ? 'Отправляем…' : 'Отправить'}</Button></div>
            </div>
          </form>
        </Card>
      )}
      <Card>
        <Title>Мои заявки</Title>
        {items.length === 0 ? <Empty>Заявок пока нет</Empty> : items.map(r => {
          const s = STATUS[r.status] || { t: r.status, tone: 'muted' as const }
          return (
            <div key={r.id} style={{ padding: '13px 0', borderTop: `1px solid ${T.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>№ {r.number} · {r.category}</span>
                <Badge tone={s.tone}>{s.t}</Badge>
              </div>
              <div style={{ fontSize: 14, color: T.sub, lineHeight: 1.5 }}>{r.description}</div>
              {r.comment && <div style={{ fontSize: 13, color: T.text, marginTop: 8, padding: '8px 10px', background: T.raised, borderRadius: 8 }}>Ответ: {r.comment}</div>}
              <div style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>{date(r.created_at)}{r.completed_date ? ` · выполнена ${date(r.completed_date)}` : ''}</div>
            </div>
          )
        })}
      </Card>
    </div>
  )
}
