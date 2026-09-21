import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface Article { id: string; title: string; content: string; category: string; created_at: string }

const CATEGORIES = ['Регламенты', 'Договоры', 'Инструкции', 'Тарифы', 'Прочее']

export function KnowledgeBasePage() {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('Регламенты')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [articles, setArticles] = useState<Article[]>([])
  const [articlesLoading, setArticlesLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => { fetchArticles() }, [])

  async function fetchArticles() {
    setArticlesLoading(true)
    const { data } = await supabase.from('kb_articles').select('*').order('created_at', { ascending: false })
    setArticles(data || [])
    setArticlesLoading(false)
  }

  async function save() {
    if (!title.trim() || !content.trim()) return
    setLoading(true)
    try {
      if (editingId) {
        const { error } = await supabase.from('kb_articles').update({ title: title.trim(), content: content.trim(), category }).eq('id', editingId)
        if (error) { setMsg('Ошибка: ' + error.message); return }
        setMsg('Статья обновлена')
        setEditingId(null)
      } else {
        const { error } = await supabase.from('kb_articles').insert({ title: title.trim(), content: content.trim(), category })
        if (error) { setMsg('Ошибка: ' + error.message); return }
        setMsg('Статья добавлена в базу знаний')
      }
      setTitle(''); setContent(''); setCategory('Регламенты')
      setTimeout(() => setMsg(''), 3000)
      fetchArticles()
    } catch { setMsg('Ошибка соединения') }
    setLoading(false)
  }

  async function deleteArticle(id: string) {
    if (!confirm('Удалить статью?')) return
    await supabase.from('kb_articles').delete().eq('id', id)
    setArticles(prev => prev.filter(a => a.id !== id))
  }

  function startEdit(a: Article) {
    setEditingId(a.id)
    setTitle(a.title)
    setContent(a.content)
    setCategory(a.category)
    window.scrollTo(0, 0)
  }

  function cancelEdit() {
    setEditingId(null)
    setTitle(''); setContent(''); setCategory('Регламенты')
  }

  const filtered = articles.filter(a => {
    if (filterCat && a.category !== filterCat) return false
    if (search && !a.title.toLowerCase().includes(search.toLowerCase()) && !a.content.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', outline: 'none' }

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2240', marginBottom: 14 }}>
            {editingId ? 'Редактировать статью' : 'Добавить статью'}
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 14, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Заголовок</label>
            <input style={inp} value={title} onChange={e => setTitle(e.target.value)} placeholder="Название документа или регламента" />
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 14, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Категория</label>
            <select style={inp} value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 14, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Содержание</label>
            <textarea style={{ ...inp, height: 120, resize: 'vertical' }} value={content} onChange={e => setContent(e.target.value)} placeholder="Вставьте текст документа, регламента или инструкции..." />
          </div>

          {msg && <div style={{ fontSize: 14, color: '#16a34a', marginBottom: 10, padding: '6px 10px', background: '#f0fdf4', borderRadius: 6 }}>{msg}</div>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={save} disabled={loading}
              style={{ flex: 1, padding: '9px', background: '#4f6ef7', color: '#fff', border: 'none', borderRadius: 7, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Сохранение...' : editingId ? 'Сохранить изменения' : 'Добавить в базу знаний'}
            </button>
            {editingId && (
              <button onClick={cancelEdit} style={{ padding: '9px 14px', background: '#fff', color: '#6b7280', border: '1px solid #e8ebf3', borderRadius: 7, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                Отмена
              </button>
            )}
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2240', marginBottom: 14 }}>Как это работает</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { icon: '📄', title: 'Добавь документ', desc: 'Договор, регламент, тарифы, инструкцию' },
              { icon: '🧠', title: 'Хранится в Supabase', desc: 'Статьи доступны всем сотрудникам' },
              { icon: '💬', title: 'AI использует контекст', desc: 'AI ассистент найдёт нужный документ и ответит точно' },
              { icon: '🔄', title: 'Обновляй', desc: 'Добавляй новые версии тарифов и регламентов' },
            ].map(item => (
              <div key={item.title} style={{ display: 'flex', gap: 10, padding: '8px 10px', background: '#f8f9fc', borderRadius: 7 }}>
                <span style={{ fontSize: 18 }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#1a2240' }}>{item.title}</div>
                  <div style={{ fontSize: 13, color: '#8596b4', marginTop: 2 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e8ebf3', borderRadius: 9, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f2f8', display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2240' }}>Статьи в базе знаний ({articles.length})</div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск..."
            style={{ padding: '5px 10px', border: '1px solid #e8ebf3', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', outline: 'none', width: 160 }} />
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
            style={{ padding: '5px 10px', border: '1px solid #e8ebf3', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}>
            <option value="">Все категории</option>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        {articlesLoading ? (
          <div style={{ padding: 16, color: '#8596b4', fontSize: 13 }}>Загрузка...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 16, color: '#8596b4', fontSize: 13 }}>Статей нет. Добавьте первую!</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f8f9fc', borderBottom: '1px solid #e8ebf3' }}>
                {['Заголовок', 'Категория', 'Превью', 'Дата', ''].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, color: '#8596b4', fontSize: 13 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id} style={{ borderBottom: '1px solid #f0f2f8' }}>
                  <td style={{ padding: '9px 12px', fontWeight: 500, color: '#1a2240', maxWidth: 200 }}>{a.title}</td>
                  <td style={{ padding: '9px 12px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 13, background: '#eff3ff', color: '#4f6ef7' }}>{a.category}</span>
                  </td>
                  <td style={{ padding: '9px 12px', color: '#8596b4', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.content.slice(0, 80)}...
                  </td>
                  <td style={{ padding: '9px 12px', color: '#8596b4', fontSize: 12, whiteSpace: 'nowrap' }}>
                    {new Date(a.created_at).toLocaleDateString('ru-RU')}
                  </td>
                  <td style={{ padding: '9px 12px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => startEdit(a)} style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid #e8ebf3', background: '#fff', color: '#4f6ef7', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Изменить</button>
                      <button onClick={() => deleteArticle(a.id)} style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid #fee2e2', background: '#fff', color: '#ef4444', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
