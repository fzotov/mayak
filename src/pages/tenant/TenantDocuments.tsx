import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { openStoredFile, storedFileUrl } from '../../lib/api'
import { T, Card, Title, Loading, Empty, date, page } from './ui'

// Те же виды документов, что в карточке арендатора у администрации.
const DOC_LABEL: Record<string, string> = {
  card: 'Карточка предприятия', charter: 'Устав', egrul: 'Выписка из ЕГРЮЛ', inn_doc: 'ИНН',
  director_order: 'Приказ о назначении руководителя', passport: 'Паспорт', poa: 'Доверенность',
  license: 'Лицензия / разрешение', brand_doc: 'Права на товарный знак', opd_consent: 'Согласие на обработку ПД',
  ogrn: 'Свидетельство ОГРНИП', self_employed_cert: 'Справка самозанятого', utility_bill: 'Квитанция ЖКХ',
  bank_details: 'Банковские реквизиты', lease: 'Договор аренды', handover: 'Акт приёма-передачи',
  addendum_rent: 'Доп. соглашение (аренда)', addendum_ad: 'Доп. соглашение (реклама)', elevator_letter: 'Письмо о пользовании лифтом',
}

/** Документы арендатора, загруженные администрацией. Ссылки временные, открываются в новой вкладке. */
export default function TenantDocuments({ tenantId }: { tenantId: string }) {
  const [docs, setDocs] = useState<any[] | null>(null)
  const [error, setError] = useState(false)
  const [links, setLinks] = useState<Record<string, string>>({})

  useEffect(() => {
    let alive = true
    supabase.from('tenant_documents').select('id,doc_type,file_name,file_url,notes,uploaded_at').eq('tenant_id', tenantId)
      .order('uploaded_at', { ascending: false }).then(({ data, error }) => {
        if (!alive) return
        if (error) { setError(true); setDocs([]); return }
        const list = data || []
        setDocs(list)
        // ссылки заранее: на iPhone окно, открытое после ожидания, браузер может заблокировать
        Promise.all(list.map(d => (d.file_url ? storedFileUrl(d.file_url).catch(() => '') : Promise.resolve(''))))
          .then(urls => { if (alive) setLinks(Object.fromEntries(list.map((d, i) => [d.id, urls[i]]))) })
      })
    return () => { alive = false }
  }, [tenantId])

  if (!docs) return <Loading />
  return (
    <div style={page}>
      <Card>
        <Title>Документы</Title>
        {error ? <Empty>Не удалось загрузить документы. Обновите страницу.</Empty>
          : docs.length === 0 ? <Empty>Документов пока нет.<br />Здесь появятся документы, которые загрузит администрация бизнес-центра.</Empty>
          : docs.map(d => {
            const href = links[d.id]
            const body = (
              <>
                <span style={{ color: T.sub, display: 'flex', flexShrink: 0, marginTop: 2 }}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                    <path d="M10 1.5H4.5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V6L10 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                    <path d="M10 1.5V6h4.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  </svg>
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 500, color: T.text }}>{DOC_LABEL[d.doc_type] || d.doc_type || 'Документ'}</span>
                  <span style={{ display: 'block', fontSize: 13, color: T.sub, marginTop: 3, overflowWrap: 'anywhere' }}>{d.file_name || 'Файл'}</span>
                  {d.notes && <span style={{ display: 'block', fontSize: 13, color: T.muted, marginTop: 3, overflowWrap: 'anywhere' }}>{d.notes}</span>}
                  <span style={{ display: 'block', fontSize: 12, color: T.muted, marginTop: 4 }}>{date(d.uploaded_at)}</span>
                </span>
                <span style={{ color: T.muted, display: 'flex', alignSelf: 'center', flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
              </>
            )
            const row: React.CSSProperties = { display: 'flex', gap: 12, alignItems: 'flex-start', width: '100%', minHeight: 44, padding: '13px 0', borderTop: `1px solid ${T.border}`, textDecoration: 'none', color: 'inherit', textAlign: 'left', fontFamily: T.font, boxSizing: 'border-box' }
            if (!d.file_url) return <div key={d.id} style={{ ...row, opacity: 0.6 }}>{body}</div>
            return href
              ? <a key={d.id} href={href} target="_blank" rel="noopener" style={row}>{body}</a>
              : <button key={d.id} type="button" onClick={() => openStoredFile(d.file_url)} style={{ ...row, background: 'none', borderLeft: 0, borderRight: 0, borderBottom: 0, cursor: 'pointer' }}>{body}</button>
          })}
      </Card>
    </div>
  )
}
