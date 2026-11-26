import { apiFetch } from '../lib/api'
import { useState, useRef, useEffect } from 'react'
import { C, Button, Input } from '../components/ui'

interface Message { role: 'user' | 'assistant'; content: string }

/** Ответ ассистента: переносы строк и **жирный**, без HTML-вставок. */
function renderText(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>)
}

const bubble: React.CSSProperties = { padding: '10px 14px', borderRadius: 10, fontSize: 14, lineHeight: 1.6, maxWidth: '80%', whiteSpace: 'pre-wrap' }

export function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Здравствуйте! Я AI-ассистент системы Маяк. Могу помочь с арендаторами, счетами и управлением недвижимостью.' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg: Message = { role: 'user', content: input }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    try {
      const res = await apiFetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages.map(m => ({ role: m.role, content: m.content })) })
      })
      const data: { content?: string; error?: string } = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.content || data.error || 'Не удалось получить ответ' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Ошибка. Попробуйте снова.' }])
    }
    setLoading(false)
  }

  const PROMPTS = [
    'Кто задолжал больше всего?',
    'Составь письмо о задолженности',
    'Какие договоры истекают?',
    'Рассчитай пени для офиса 203',
    'Список свободных помещений',
  ]

  return (
    <div style={{ maxWidth: 800, color: C.text }}>
      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: C.radius, display: 'flex', flexDirection: 'column', height: 500 }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.map((m, i) => (
            <div key={i} style={{
              ...bubble,
              background: m.role === 'user' ? C.accent : C.card2,
              color: m.role === 'user' ? C.onAccent : C.text,
              border: m.role === 'assistant' ? `1px solid ${C.line}` : 'none',
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            }}>
              {renderText(m.content)}
            </div>
          ))}
          {loading && (
            <div style={{ ...bubble, background: C.card2, border: `1px solid ${C.line}`, alignSelf: 'flex-start', color: C.faint }}>
              Думаю…
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.line}`, display: 'flex', gap: 8 }}>
          <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Задайте вопрос об арендаторах, счетах, договорах..." style={{ flex: 1 }} />
          <Button kind="primary" onClick={send} disabled={loading}>Отправить</Button>
        </div>
      </div>

      <div style={{ marginTop: 10, display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        {PROMPTS.map(q => (
          <button key={q} type="button" onClick={() => setInput(q)}
            style={{ padding: '5px 12px', background: C.card, border: `1px solid ${C.line}`, borderRadius: 20, fontSize: 13, color: C.accent, cursor: 'pointer', fontFamily: 'inherit' }}>
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}
