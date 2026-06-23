import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

interface Letter {
  id: string
  type: 'incoming' | 'outgoing'
  status: string
  subject: string
  body: string
  sender: string
  recipient: string
  tenant_id: string | null
  date: string
  file_url: string
  ai_summary: string
  ai_action: string
  created_at: string
}

const statusLabel: Record<string, { label: string; bg: string; color: string }> = {
  draft: { label: 'Черновик', bg: '#f3f4f6', color: '#6b7280' },
  sent: { label: 'Отправлено', bg: '#dbeafe', color: '#1d4ed8' },
  received: { label: 'Получено', bg: '#dcfce7', color: '#16a34a' },
  processed: { label: 'Обработано', bg: '#ede9fe', color: '#7c3aed' },
}

const inp: React.CSSProperties = { width: '100%', border: '1px solid #e5e7eb', borderRadius: 6, padding: '7px 10px', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const }
const lbl: React.CSSProperties = { fontSize: 12, color: '#6b7280', marginBottom: 4, display: 'block', fontWeight: 500 }

function PromptModal({ onClose, onGenerate }: { onClose: () => void; onGenerate: (prompt: string) => void }) {
  const [prompt, setPrompt] = useState('')
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#00000060', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 500, boxShadow: '0 8px 32px #0003', border: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>✦ Генерация письма AI</div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 18, color: '#9ca3af', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 10 }}>Опишите подробно содержание письма — тон, ключевые моменты, требования, сроки.</div>
          <textarea
            style={{ ...inp, height: 140, resize: 'vertical' }}
            placeholder="Например: письмо-напоминание об оплате аренды за июнь, срок оплаты был 5 числа, прошло уже 10 дней, попросить оплатить в течение 3 дней иначе будут начислены пени согласно договору"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            autoFocus
          />
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '14px 20px', borderTop: '1px solid #e5e7eb' }}>
          <button onClick={() => onGenerate(prompt)} disabled={!prompt.trim()} style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', background: '#111', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: !prompt.trim() ? 0.5 : 1 }}>
            Сгенерировать
          </button>
          <button onClick={onClose} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Отмена</button>
        </div>
      </div>
    </div>
  )
}

function LetterModal({ letter, onClose, onSaved }: { letter: Letter | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    type: letter?.type || 'outgoing',
    status: letter?.status || 'draft',
    subject: letter?.subject || '',
    body: letter?.body || '',
    sender: letter?.sender || '',
    recipient: letter?.recipient || '',
    date: letter?.date || new Date().toISOString().slice(0, 10),
    ai_summary: letter?.ai_summary || '',
    ai_action: letter?.ai_action || '',
  })
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function generateLetter(prompt: string) {
    setShowPrompt(false)
    setGenerating(true)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `Напиши деловое письмо на русском языке для управляющей компании бизнес-центра "Маяк".
Тема: ${form.subject || 'не указана'}
Получатель: ${form.recipient || 'арендатор'}
Отправитель: ${form.sender || 'Администрация БЦ Маяк'}
Инструкции: ${prompt}

Верни только текст письма без пояснений.`
          }]
        })
      })
      const data = await res.json()
      const text = data.content?.[0]?.text || ''
      if (!text) throw new Error('empty')
      set('body', text)
    } catch (e) {
      alert('Ошибка генерации')
    }
    setGenerating(false)
  }

  async function processFile() {
    if (!file) return
    setProcessing(true)
    try {
      const base64 = await new Promise<string>((res) => {
        const reader = new FileReader()
        reader.onload = () => res((reader.result as string).split(',')[1])
        reader.readAsDataURL(file)
      })
      const isImage = file.type.startsWith('image/')
      const content: any[] = []
      if (isImage) {
        content.push({ type: 'image', source: { type: 'base64', media_type: file.type, data: base64 } })
      } else {
        content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } })
      }
      content.push({ type: 'text', text: 'Извлеки содержимое письма. Верни JSON: {"subject":"","sender":"","recipient":"","date":"YYYY-MM-DD","body":"","summary":"","action":""}. Только JSON.' })

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1000, messages: [{ role: 'user', content }] })
      })
      const data = await res.json()
      const text = data.content?.[0]?.text || '{}'
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
      if (parsed.subject) set('subject', parsed.subject)
      if (parsed.sender) set('sender', parsed.sender)
      if (parsed.recipient) set('recipient', parsed.recipient)
      if (parsed.date) set('date', parsed.date)
      if (parsed.body) set('body', parsed.body)
      if (parsed.summary) set('ai_summary', parsed.summary)
      if (parsed.action) set('ai_action', parsed.action)
      set('type', 'incoming')
      set('status', 'received')
    } catch (e) {
      alert('Ошибка обработки файла')
    }
    setProcessing(false)
  }

  async function save() {
    if (!form.subject) return alert('Введите тему')
    setSaving(true)
    if (letter?.id) {
      const r = await supabase.from('letters').update(form).eq('id', letter.id)
      if (r.error) { alert('Ошибка: ' + r.error.message); setSaving(false); return }
    } else {
      const r = await supabase.from('letters').insert(form)
      if (r.error) { alert('Ошибка: ' + r.error.message); setSaving(false); return }
    }
    setSaving(false)
    onSaved()
  }

  async function remove() {
    if (!letter?.id || !confirm('Удалить письмо?')) return
    await supabase.from('letters').delete().eq('id', letter.id)
    onSaved()
  }

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: '#00000050', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px #0003', border: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>{letter ? 'Письмо' : 'Новое письмо'}</div>
            <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 18, color: '#9ca3af', cursor: 'pointer' }}>✕</button>
          </div>

          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: '#f9fafb', border: '2px dashed #e5e7eb', borderRadius: 8, padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>Загрузить входящее письмо (PDF, фото)</div>
              <input ref={fileRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] || null)} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button onClick={() => fileRef.current?.click()} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {file ? file.name : 'Выбрать файл'}
                </button>
                {file && (
                  <button onClick={processFile} disabled={processing} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#7c3aed', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', opacity: processing ? 0.6 : 1 }}>
                    {processing ? '⏳ Обработка...' : '✦ Обработать AI'}
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={lbl}>Тип</label>
                <select style={inp} value={form.type} onChange={e => set('type', e.target.value)}>
                  <option value="outgoing">Исходящее</option>
                  <option value="incoming">Входящее</option>
                </select>
              </div>
              <div><label style={lbl}>Статус</label>
                <select style={inp} value={form.status} onChange={e => set('status', e.target.value)}>
                  <option value="draft">Черновик</option>
                  <option value="sent">Отправлено</option>
                  <option value="received">Получено</option>
                  <option value="processed">Обработано</option>
                </select>
              </div>
            </div>

            <div><label style={lbl}>Тема *</label><input style={inp} value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="Уведомление об изменении арендной ставки" /></div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={lbl}>От кого</label><input style={inp} value={form.sender} onChange={e => set('sender', e.target.value)} placeholder="Администрация БЦ Маяк" /></div>
              <div><label style={lbl}>Кому</label><input style={inp} value={form.recipient} onChange={e => set('recipient', e.target.value)} placeholder="ООО Техцентр" /></div>
            </div>

            <div><label style={lbl}>Дата</label><input style={inp} type="date" value={form.date} onChange={e => set('date', e.target.value)} /></div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <label style={lbl}>Текст письма</label>
                {form.type === 'outgoing' && (
                  <button onClick={() => setShowPrompt(true)} disabled={generating} style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: '#111', color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', opacity: generating ? 0.6 : 1 }}>
                    {generating ? '⏳ Генерация...' : '✦ Сгенерировать AI'}
                  </button>
                )}
              </div>
              <textarea style={{ ...inp, height: 180, resize: 'vertical' }} value={form.body} onChange={e => set('body', e.target.value)} placeholder="Текст письма..." />
            </div>

            {(form.ai_summary || form.ai_action) && (
              <div style={{ background: '#f5f3ff', border: '1px solid #ede9fe', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#7c3aed', marginBottom: 6 }}>✦ AI Анализ</div>
                {form.ai_summary && <div style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}><b>Резюме:</b> {form.ai_summary}</div>}
                {form.ai_action && <div style={{ fontSize: 13, color: '#374151' }}><b>Требуемое действие:</b> {form.ai_action}</div>}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, padding: '14px 20px', borderTop: '1px solid #e5e7eb' }}>
            <button onClick={save} disabled={saving} style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', background: '#111', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
            {letter && <button onClick={remove} style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: '#fee2e2', color: '#ef4444', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Удалить</button>}
            <button onClick={onClose} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Отмена</button>
          </div>
        </div>
      </div>
      {showPrompt && <PromptModal onClose={() => setShowPrompt(false)} onGenerate={generateLetter} />}
    </>
  )
}

export default function LettersPage() {
  const [letters, setLetters] = useState<Letter[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Letter | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => { fetchLetters() }, [])

  async function fetchLetters() {
    setLoading(true)
    const { data } = await supabase.from('letters').select('*').order('date', { ascending: false })
    setLetters(data || [])
    setLoading(false)
  }

  const filtered = letters.filter(l => {
    if (typeFilter && l.type !== typeFilter) return false
    if (statusFilter && l.status !== statusFilter) return false
    return true
  })

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <select style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '7px 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff' }}
          value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">Все типы</option>
          <option value="incoming">Входящие</option>
          <option value="outgoing">Исходящие</option>
        </select>
        <select style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '7px 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff' }}
          value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Все статусы</option>
          <option value="draft">Черновик</option>
          <option value="sent">Отправлено</option>
          <option value="received">Получено</option>
          <option value="processed">Обработано</option>
        </select>
        <div style={{ flex: 1 }} />
        <button onClick={() => { setSelected(null); setShowModal(true) }} style={{ padding: '7px 16px', border: 'none', borderRadius: 6, background: '#111', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Новое письмо
        </button>
      </div>

      {loading ? <div style={{ color: '#9ca3af', fontSize: 14 }}>Загрузка...</div> : (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Тип', 'Дата', 'Тема', 'От/Кому', 'Статус', 'AI резюме'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500, color: '#6b7280', fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id} onClick={() => { setSelected(l); setShowModal(true) }} style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 10, background: l.type === 'incoming' ? '#dcfce7' : '#dbeafe', color: l.type === 'incoming' ? '#16a34a' : '#1d4ed8' }}>
                      {l.type === 'incoming' ? '↓ Входящее' : '↑ Исходящее'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', color: '#6b7280' }}>{l.date ? new Date(l.date).toLocaleDateString('ru') : '—'}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 500, color: '#111' }}>{l.subject || '—'}</td>
                  <td style={{ padding: '10px 14px', color: '#6b7280', fontSize: 13 }}>{l.type === 'incoming' ? l.sender : l.recipient}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {(() => { const s = statusLabel[l.status] || statusLabel.draft; return <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 10, background: s.bg, color: s.color }}>{s.label}</span> })()}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#9ca3af', fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.ai_summary || '—'}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Писем не найдено</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && <LetterModal letter={selected} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); fetchLetters() }} />}
    </div>
  )
}
