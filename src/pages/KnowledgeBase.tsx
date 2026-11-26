// База знаний: статьи (регламенты, договоры, инструкции, тарифы), которыми пользуется AI-ассистент.
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { sb, useSb, useAction, QueryState } from '../lib/query'
import type { Tables } from '../lib/database.types'
import { Page, Card, Row, Button, Badge, Table, Field, Input, Select, Textarea, Search, Notice, dateRu, C } from '../components/ui'
import { ask } from '../components/Dialogs'

type Article = Tables<'kb_articles'>

const CATEGORIES = ['Регламенты', 'Договоры', 'Инструкции', 'Тарифы', 'Прочее']

const HOW = [
  { title: 'Добавь документ', desc: 'Договор, регламент, тарифы, инструкцию' },
  { title: 'Хранится в Supabase', desc: 'Статьи доступны всем сотрудникам' },
  { title: 'AI использует контекст', desc: 'AI ассистент найдёт нужный документ и ответит точно' },
  { title: 'Обновляй', desc: 'Добавляй новые версии тарифов и регламентов' },
]

export function KnowledgeBasePage() {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('Регламенты')
  const [msg, setMsg] = useState<{ tone: 'green' | 'red'; text: string } | null>(null)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  const articlesQ = useSb(['kb_articles'], () => sb(supabase.from('kb_articles').select('*').order('created_at', { ascending: false })))
  const articles = articlesQ.data ?? []

  const saveA = useAction(async (v: { id: string | null; title: string; content: string; category: string }) => {
    const row = { title: v.title, content: v.content, category: v.category }
    if (v.id) await sb(supabase.from('kb_articles').update(row).eq('id', v.id))
    else await sb(supabase.from('kb_articles').insert(row))
  }, { invalidate: ['kb_articles'] })
  const loading = saveA.isPending

  const deleteA = useAction(async (id: string) => {
    await sb(supabase.from('kb_articles').delete().eq('id', id))
  }, { invalidate: ['kb_articles'] })

  function save() {
    if (!title.trim() || !content.trim()) return
    const wasEditing = !!editingId
    saveA.mutate({ id: editingId, title: title.trim(), content: content.trim(), category }, {
      onSuccess: () => {
        setMsg({ tone: 'green', text: wasEditing ? 'Статья обновлена' : 'Статья добавлена в базу знаний' })
        if (wasEditing) setEditingId(null)
        setTitle(''); setContent(''); setCategory('Регламенты')
        setTimeout(() => setMsg(null), 3000)
      },
      onError: e => setMsg({ tone: 'red', text: 'Ошибка: ' + e.message }),
    })
  }

  async function deleteArticle(id: string) {
    if (!(await ask('Удалить статью?', { ok: 'Удалить', danger: true }))) return
    deleteA.mutate(id, { onError: e => setMsg({ tone: 'red', text: 'Статья не удалена: ' + e.message }) })
  }

  function startEdit(a: Article) {
    setEditingId(a.id)
    setTitle(a.title)
    setContent(a.content)
    setCategory(a.category)
    setMsg(null)
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

  return (
    <Page>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <Card title={editingId ? 'Редактировать статью' : 'Добавить статью'}>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Заголовок">
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Название документа или регламента" />
            </Field>
            <Field label="Категория">
              <Select value={category} onChange={e => setCategory(e.target.value)}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Содержание">
              <Textarea style={{ height: 120 }} value={content} onChange={e => setContent(e.target.value)} placeholder="Вставьте текст документа, регламента или инструкции…" />
            </Field>
            {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
            <Row gap={8}>
              <Button kind="primary" onClick={save} disabled={loading || !title.trim() || !content.trim()} style={{ flex: 1 }}>
                {loading ? 'Сохранение…' : editingId ? 'Сохранить изменения' : 'Добавить в базу знаний'}
              </Button>
              {editingId && <Button onClick={cancelEdit}>Отмена</Button>}
            </Row>
          </div>
        </Card>

        <Card title="Как это работает">
          <div style={{ display: 'grid', gap: 8 }}>
            {HOW.map((item, i) => (
              <div key={item.title} style={{ display: 'flex', gap: 10, padding: '8px 10px', background: C.card2, borderRadius: C.radiusSm }}>
                <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 11, background: C.accentBg, color: C.accent, fontSize: 12, fontWeight: 600, display: 'grid', placeItems: 'center' }}>{i + 1}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{item.title}</div>
                  <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card pad={false} title={`Статьи в базе знаний (${articles.length})`} actions={
        <Row gap={8}>
          <Search value={search} onChange={setSearch} placeholder="Поиск" width={180} />
          <Select style={{ width: 'auto' }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option value="">Все категории</option>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </Select>
        </Row>
      }>
        <QueryState q={articlesQ}>{() => (
          <Table rows={filtered} rowKey={a => a.id}
            empty={articles.length === 0 ? 'Статей нет. Добавьте первую.' : 'Ничего не найдено'} cols={[
              { key: 't', title: 'Заголовок', sort: a => a.title, render: a => <div style={{ fontWeight: 500, maxWidth: 240 }}>{a.title}</div> },
              { key: 'c', title: 'Категория', sort: a => a.category, render: a => <Badge tone="blue">{a.category}</Badge> },
              { key: 'p', title: 'Превью', render: a => (
                <div style={{ color: C.muted, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.content.slice(0, 80)}…</div>
              ) },
              { key: 'd', title: 'Дата', sort: a => a.created_at, render: a => <span style={{ color: C.muted, fontSize: 12, whiteSpace: 'nowrap' }}>{dateRu(a.created_at)}</span> },
              { key: 'x', title: '', render: a => (
                <Row gap={6} wrap={false}>
                  <Button small onClick={() => startEdit(a)}>Изменить</Button>
                  <Button small kind="danger" onClick={() => deleteArticle(a.id)}>Удалить</Button>
                </Row>
              ) },
            ]} />
        )}</QueryState>
      </Card>
    </Page>
  )
}
