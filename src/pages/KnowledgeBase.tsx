import { useState } from 'react'

interface Article { title: string; content: string; category: string }

const CATEGORIES = ['Регламенты', 'Договоры', 'Инструкции', 'Тарифы', 'Прочее']

export function KnowledgeBasePage() {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('Регламенты')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [articles, setArticles] = useState<Article[]>([
    { title: 'Регламент обхода помещений', category: 'Регламенты', content: 'Ежедневный обход проводится с 9:00 до 10:00...' },
    { title: 'Тарифы на электроэнергию 2025', category: 'Тарифы', content: 'Тариф 6.38 руб/кВт·ч + надбавка 6.38%...' },
    { title: 'Порядок выставления счетов', category: 'Инструкции', content: 'Постоянная часть выставляется до 25 числа предыдущего месяца...' },
  ])

  const save = async () => {
    if (!title || !content) return
    setLoading(true)
    try {
      const res = await fetch('/api/kb-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, category })
      })
      const data = await res.json()
      if (data.ok) {
        setArticles(prev => [{ title, content, category }, ...prev])
        setTitle(''); setContent('')
        setMsg('Статья добавлена в базу знаний AI')
        setTimeout(() => setMsg(''), 3000)
      }
    } catch { setMsg('Ошибка') }
    setLoading(false)
  }

  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', outline: 'none' }

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ fontSize: 18, fontWeight: 600, color: '#1a2240', marginBottom: 20 }}>База знаний</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2240', marginBottom: 14 }}>Добавить статью</div>
          
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Заголовок</label>
            <input style={inp} value={title} onChange={e => setTitle(e.target.value)} placeholder="Название документа или регламента" />
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Категория</label>
            <select style={inp} value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Содержание</label>
            <textarea style={{ ...inp, height: 120, resize: 'vertical' }} value={content} onChange={e => setContent(e.target.value)} placeholder="Вставьте текст документа, регламента или инструкции..." />
          </div>

          {msg && <div style={{ fontSize: 12, color: '#16a34a', marginBottom: 10, padding: '6px 10px', background: '#f0fdf4', borderRadius: 6 }}>{msg}</div>}

          <button onClick={save} disabled={loading}
            style={{ width: '100%', padding: '9px', background: '#4f6ef7', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
            {loading ? 'Сохранение...' : 'Добавить в базу знаний AI'}
          </button>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2240', marginBottom: 14 }}>Как это работает</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { icon: '📄', title: 'Добавь документ', desc: 'Договор, регламент, тарифы, инструкцию' },
              { icon: '🧠', title: 'AI запоминает', desc: 'Документ векторизуется и сохраняется в Supabase' },
              { icon: '💬', title: 'Задай вопрос', desc: 'AI находит нужный документ и отвечает точно' },
              { icon: '🔄', title: 'Обновляй', desc: 'Добавляй новые версии тарифов и регламентов' },
            ].map(item => (
              <div key={item.title} style={{ display: 'flex', gap: 10, padding: '8px 10px', background: '#f8f9fc', borderRadius: 7 }}>
                <span style={{ fontSize: 18 }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#1a2240' }}>{item.title}</div>
                  <div style={{ fontSize: 11, color: '#8596b4', marginTop: 2 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f2f8', fontSize: 13, fontWeight: 600, color: '#1a2240' }}>
          Статьи в базе знаний ({articles.length})
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f8f9fc', borderBottom: '1px solid #e8ebf3' }}>
              {['Заголовок', 'Категория', 'Превью'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, color: '#8596b4', fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {articles.map((a, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f0f2f8' }}>
                <td style={{ padding: '9px 12px', fontWeight: 500, color: '#1a2240' }}>{a.title}</td>
                <td style={{ padding: '9px 12px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, background: '#eff3ff', color: '#4f6ef7' }}>{a.category}</span>
                </td>
                <td style={{ padding: '9px 12px', color: '#8596b4', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.content.slice(0, 80)}...
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
