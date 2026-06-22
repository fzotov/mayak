import { useState, useRef, useEffect } from 'react'

interface Message { role: 'user' | 'assistant'; content: string }

export function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hello! I am your Mayak AI assistant. Ask me anything about tenants, invoices, or property management.' }
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
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages.map(m => ({ role: m.role, content: m.content })) })
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.content }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error. Please try again.' }])
    }
    setLoading(false)
  }

  const s: React.CSSProperties = { width: '100%', maxWidth: 800 }
  const bubble = (m: Message) => ({
    padding: '10px 14px',
    borderRadius: 10,
    fontSize: 13,
    lineHeight: 1.6,
    maxWidth: '80%',
    background: m.role === 'user' ? '#4f6ef7' : '#fff',
    color: m.role === 'user' ? '#fff' : '#1a2240',
    border: m.role === 'assistant' ? '1px solid #e8ebf3' : 'none',
    alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
  } as React.CSSProperties)

  return (
    <div style={s}>
      <div style={{ fontSize: 18, fontWeight: 600, color: '#1a2240', marginBottom: 16 }}>AI Assistant</div>

      <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 12, display: 'flex', flexDirection: 'column', height: 520 }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.map((m, i) => (
            <div key={i} style={bubble(m)}>{m.content}</div>
          ))}
          {loading && <div style={{ ...bubble({ role: 'assistant', content: '' }), color: '#9ca3af' }}>Thinking...</div>}
          <div ref={bottomRef} />
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid #e8ebf3', display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Ask about tenants, invoices, generate a letter..."
            style={{ flex: 1, padding: '9px 12px', border: '1px solid #e8ebf3', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
          />
          <button onClick={send} disabled={loading}
            style={{ padding: '9px 18px', background: '#4f6ef7', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
            Send
          </button>
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[
          'Who has overdue payments?',
          'Generate a debt notice letter',
          'List expiring leases',
          'Calculate penalties for office 203'
        ].map(q => (
          <button key={q} onClick={() => { setInput(q) }}
            style={{ padding: '5px 12px', background: '#fff', border: '1px solid #e8ebf3', borderRadius: 20, fontSize: 12, color: '#4f6ef7', cursor: 'pointer', fontFamily: 'inherit' }}>
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}
