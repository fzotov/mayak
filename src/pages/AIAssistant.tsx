import { useState, useRef, useEffect } from 'react'

interface Message { role: 'user' | 'assistant'; content: string }
type Model = 'claude' | 'gpt'

export function AIAssistantPage() {
  const [model, setModel] = useState<Model>('claude')
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
      const endpoint = model === 'claude' ? '/api/ai-chat' : '/api/ai-chat-gpt'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages.map(m => ({ role: m.role, content: m.content })) })
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.content || data.error }])
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
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
, fontWeight: 400, color: '#8596b4', display: 'none' }}>AI Ассистент</div>
        <div style={{ display: 'flex', background: '#f0f2f8', borderRadius: 8, padding: 3, gap: 2 }}>
          <button onClick={() => setModel('claude')}
            style={{ padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
              background: model === 'claude' ? '#fff' : 'transparent',
              color: model === 'claude' ? '#1a2240' : '#8596b4' }}>
            Claude
          </button>
          <button onClick={() => setModel('gpt')}
            style={{ padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
              background: model === 'gpt' ? '#fff' : 'transparent',
              color: model === 'gpt' ? '#1a2240' : '#8596b4' }}>
            ChatGPT
          </button>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 12, display: 'flex', flexDirection: 'column', height: 500 }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.map((m, i) => (
            <div key={i} style={{
              padding: '10px 14px', borderRadius: 10, fontSize: 13, lineHeight: 1.6, maxWidth: '80%',
              background: m.role === 'user' ? '#4f6ef7' : '#f8f9fc',
              color: m.role === 'user' ? '#fff' : '#1a2240',
              border: m.role === 'assistant' ? '1px solid #e8ebf3' : 'none',
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            }}>
              {m.content}
            </div>
          ))}
          {loading && (
            <div style={{ padding: '10px 14px', borderRadius: 10, fontSize: 13, background: '#f8f9fc', border: '1px solid #e8ebf3', alignSelf: 'flex-start', color: '#9ca3af' }}>
              {model === 'claude' ? 'Claude думает...' : 'ChatGPT думает...'}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid #e8ebf3', display: 'flex', gap: 8 }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Задайте вопрос об арендаторах, счетах, договорах..."
            style={{ flex: 1, padding: '9px 12px', border: '1px solid #e8ebf3', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
          <button onClick={send} disabled={loading}
            style={{ padding: '9px 18px', background: '#4f6ef7', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}>
            Отправить
          </button>
        </div>
      </div>

      <div style={{ marginTop: 10, display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        {PROMPTS.map(q => (
          <button key={q} onClick={() => setInput(q)}
            style={{ padding: '5px 12px', background: '#fff', border: '1px solid #e8ebf3', borderRadius: 20, fontSize: 12, color: '#4f6ef7', cursor: 'pointer', fontFamily: 'inherit' }}>
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}
