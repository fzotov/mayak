// Разбор файла выписки 1CClientBankExchange (выгрузка «в 1С» из СберБизнес, kl_to_1c.txt).
// Без ИИ: поля читаются по именам формата. Один файл может содержать несколько расчётных счетов —
// для каждого получается отдельная выписка.

export interface BankDoc {
  key: string; date: string; number: string; amount: number; direction: 'credit' | 'debit'
  counterparty: string; counter_inn: string; counter_account: string; purpose: string
}
export interface ParsedStatement {
  file_name: string; sha256: string; account: string; date_from: string | null; date_to: string | null
  opening: number | null; total_in: number | null; total_out: number | null; closing: number | null; docs: BankDoc[]
}

function decode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return new TextDecoder('utf-8').decode(bytes)
  const head = new TextDecoder('windows-1251').decode(bytes.slice(0, 600))
  if (/Кодировка\s*=\s*DOS/i.test(head)) return new TextDecoder('ibm866').decode(bytes)
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch { return new TextDecoder('windows-1251').decode(bytes) }
}

const date = (s?: string) => {
  const m = (s || '').trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}
const num = (s?: string) => (s && s.trim() !== '' ? Number(s.trim().replace(',', '.')) : null)

async function sha256(buf: ArrayBuffer) {
  const h = await crypto.subtle.digest('SHA-256', buf)
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function parseClientBank(file: File): Promise<ParsedStatement[]> {
  const buf = await file.arrayBuffer()
  const text = decode(buf)
  if (!/^\s*1CClientBankExchange/.test(text)) throw new Error('Это не файл выписки для 1С. В СберБизнес выберите «Выписка → Экспорт → в 1С» (файл kl_to_1c.txt).')
  const hash = await sha256(buf)
  const lines = text.split(/\r?\n/)

  const accounts: Record<string, string>[] = []
  const docs: Record<string, string>[] = []
  let cur: Record<string, string> | null = null
  let kind: 'acc' | 'doc' | null = null
  const header: Record<string, string> = {}
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    if (line === 'СекцияРасчСчет') { cur = {}; kind = 'acc'; continue }
    if (line === 'КонецРасчСчет') { if (cur) accounts.push(cur); cur = null; kind = null; continue }
    if (line.startsWith('СекцияДокумент')) { cur = { _type: line.split('=')[1] || '' }; kind = 'doc'; continue }
    if (line === 'КонецДокумента') { if (cur) docs.push(cur); cur = null; kind = null; continue }
    const i = line.indexOf('=')
    if (i < 0) continue
    const k = line.slice(0, i).trim(), v = line.slice(i + 1).trim()
    if (cur && kind) { if (!(k in cur)) cur[k] = v } else header[k] = v
  }

  const ours = new Set([...accounts.map(a => a['РасчСчет']), ...(header['РасчСчет'] ? [header['РасчСчет']] : [])].filter(Boolean))
  if (!ours.size) throw new Error('В файле не найден расчётный счёт (поле РасчСчет)')

  return [...ours].map(account => {
    const sec = accounts.find(a => a['РасчСчет'] === account) || {}
    const own = docs.flatMap<BankDoc>(d => {
      const amount = num(d['Сумма']) || 0
      const isIn = d['ПолучательСчет'] === account, isOut = d['ПлательщикСчет'] === account
      if (!isIn && !isOut) return []
      const direction = isIn && !isOut ? 'credit' : 'debit'
      const side = direction === 'credit' ? 'Плательщик' : 'Получатель'
      const dt = (direction === 'credit' ? date(d['ДатаПоступило']) : date(d['ДатаСписано'])) || date(d['Дата']) || ''
      const counterparty = d[side + '1'] || (d[side] || '').replace(/^ИНН\s*\d+\s*/, '')
      const counter_account = d[side + 'Счет'] || d[side + 'РасчСчет'] || ''
      return [{
        key: [dt, d['Номер'] || '', amount.toFixed(2), direction, counter_account, d['Дата'] || ''].join('|'),
        date: dt, number: d['Номер'] || '', amount, direction, counterparty,
        counter_inn: (d[side + 'ИНН'] || '').replace(/\D/g, ''), counter_account,
        purpose: d['НазначениеПлатежа'] || '',
      }]
    })
    return {
      file_name: file.name, sha256: ours.size > 1 ? `${hash}:${account}` : hash, account,
      date_from: date(sec['ДатаНачала'] || header['ДатаНачала']), date_to: date(sec['ДатаКонца'] || header['ДатаКонца']),
      opening: num(sec['НачальныйОстаток']), total_in: num(sec['ВсегоПоступило']), total_out: num(sec['ВсегоСписано']), closing: num(sec['КонечныйОстаток']),
      docs: own,
    }
  })
}
