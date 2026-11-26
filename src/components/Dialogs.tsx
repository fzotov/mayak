// Подтверждение и уведомление в стиле приложения вместо системных confirm() и alert().
// Хост монтируется один раз (админка и кабинет), вызывать можно из любого места:
//   if (!(await ask('Удалить задачу?', { ok: 'Удалить', danger: true }))) return
//   notify('Не удалось открыть файл', 'red')
import { useEffect, useState } from 'react'
import { Modal, Button, C } from './ui'

type Ask = { text: string; ok: string; danger: boolean; resolve: (v: boolean) => void }
type Note = { id: number; text: string; tone: 'red' | 'green' | 'neutral' }

let pushAsk: ((a: Ask) => void) | null = null
let pushNote: ((n: Note) => void) | null = null
let seq = 0

export function ask(text: string, opts: { ok?: string; danger?: boolean } = {}): Promise<boolean> {
  if (!pushAsk) return Promise.resolve(window.confirm(text))
  return new Promise(resolve => pushAsk!({ text, ok: opts.ok || 'Да', danger: !!opts.danger, resolve }))
}

export function notify(text: string, tone: Note['tone'] = 'neutral') {
  if (!pushNote) { window.alert(text); return }
  pushNote({ id: ++seq, text, tone })
}

export function DialogHost() {
  const [q, setQ] = useState<Ask | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  useEffect(() => {
    pushAsk = a => setQ(prev => { prev?.resolve(false); return a })
    pushNote = n => {
      setNotes(list => [...list.slice(-2), n])
      setTimeout(() => setNotes(list => list.filter(x => x.id !== n.id)), n.tone === 'red' ? 8000 : 4000)
    }
    return () => { pushAsk = null; pushNote = null }
  }, [])
  const close = (v: boolean) => { q?.resolve(v); setQ(null) }
  return (
    <>
      {q && (
        <Modal title="Подтвердите" onClose={() => close(false)} width={420}
          footer={<><Button onClick={() => close(false)}>Отмена</Button><Button kind={q.danger ? 'danger' : 'primary'} autoFocus onClick={() => close(true)}>{q.ok}</Button></>}>
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{q.text}</div>
        </Modal>
      )}
      <div aria-live="polite" style={{ position: 'fixed', left: 16, right: 16, bottom: 'calc(84px + env(safe-area-inset-bottom))', zIndex: 1100, display: 'grid', justifyItems: 'center', gap: 8, pointerEvents: 'none' }}>
        {notes.map(n => (
          <div key={n.id} role="status" onClick={() => setNotes(l => l.filter(x => x.id !== n.id))}
            style={{ pointerEvents: 'auto', maxWidth: 480, padding: '10px 14px', borderRadius: 10, fontSize: 14, lineHeight: 1.45, cursor: 'pointer', boxShadow: C.shadow, whiteSpace: 'pre-wrap',
              background: n.tone === 'red' ? C.redBg : n.tone === 'green' ? C.greenBg : C.card, color: n.tone === 'red' ? C.red : n.tone === 'green' ? C.green : C.text, border: `1px solid ${C.line}` }}>
            {n.text}
          </div>
        ))}
      </div>
    </>
  )
}
