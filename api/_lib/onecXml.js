// Разбор выгрузки взаиморасчётов 1С (debts.xml) настоящим XML-парсером. Используется сервером и браузером.
//
// Формат (действующий, см. docs/1c-export-v2.md — там же расширения v2):
// <Debts generated asOf operationsFrom org orgInn [version="2"]>
//   <Counterparty id name inn kpp debt advance [deposit]>
//     <Contract id name [number date kind] debt advance [deposit]>
//       <Doc id type number date debt advance [account]>
//         [<Line item itemCode account amount/>]      — v2: строки документа с номенклатурой
//       </Doc>
//     </Contract>
//     <Op id kind type number date contractId charged paid/>
//   </Counterparty>
// </Debts>
import { XMLParser } from 'fast-xml-parser'

const num = v => {
  const n = parseFloat(String(v ?? '0').replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}
const arr = v => (v == null ? [] : Array.isArray(v) ? v : [v])
const str = v => (v == null ? '' : String(v).trim())

/** Дата 1С ('2026-08-31T00:00:00', '31.08.2026') → 'YYYY-MM-DD' или null. */
export function onecDate(v) {
  const s = str(v)
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return null
}

/** Номер и дата договора из наименования: «Договор аренды № 13/2026 от 22.06.2026». */
const MONTHS = { январ: '01', феврал: '02', март: '03', апрел: '04', ма: '05', июн: '06', июл: '07', август: '08', сентябр: '09', октябр: '10', ноябр: '11', декабр: '12' }

/** Номер, дата и вид договора из наименования: «Договор аренды № 13/2026 от 22.06.2026», «7-вз от 01.07.2026», «№47 от 01 июля 2016 г.». */
export function contractFromName(name) {
  const s = str(name)
  if (/^основной договор$/i.test(s)) return { number: null, date: null, kind: 'other' }
  const no = s.match(/№\s*([^\s,]+(?:\s*\/\s*[^\s,]+)?)/) || s.match(/(?:^|\s)((?=[^\s,]*\d)[0-9A-Za-zА-Яа-яЁё][^\s,]*)\s+от\s/)
  let date = null
  const dt = s.match(/от\s+(\d{2}\.\d{2}\.\d{4})/)
  if (dt) date = onecDate(dt[1])
  else {
    const w = s.toLowerCase().match(/от\s+(\d{1,2})\s+([а-яё]+)\s+(\d{4})/)
    const mm = w && Object.entries(MONTHS).find(([k]) => w[2].startsWith(k))
    if (w && mm) date = `${w[3]}-${mm[1]}-${w[1].padStart(2, '0')}`
  }
  const low = s.toLowerCase()
  const kind = /реклам|стел/.test(low) ? 'ad' : /аренд|арены/.test(low) ? 'rent' : /обеспеч|гарант|депозит|залог/.test(low) ? 'deposit' : /услуг|возмещ|коммун/.test(low) ? 'service' : 'other'
  return { number: no ? no[1].replace(/\s+/g, '') : null, date, kind }
}

export function parseDebtsXml(xml) {
  const parser = new XMLParser({
    ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: false, parseTagValue: false, trimValues: true,
    isArray: name => ['Counterparty', 'Contract', 'Doc', 'Line', 'Op'].includes(name),
  })
  let root
  try { root = parser.parse(xml) } catch (e) { throw new Error('Выгрузка 1С повреждена: ' + e.message) }
  const d = root?.Debts
  if (!d) throw new Error('Это не выгрузка взаиморасчётов 1С (нет корневого элемента Debts)')

  const meta = {
    generated: str(d.generated), asOf: onecDate(d.asOf), operationsFrom: onecDate(d.operationsFrom),
    org: str(d.org), orgInn: str(d.orgInn), version: str(d.version) || '1',
  }
  const counterparties = arr(d.Counterparty).map(cp => ({
    id: str(cp.id), name: str(cp.name), inn: str(cp.inn), kpp: str(cp.kpp),
    debt: num(cp.debt), advance: num(cp.advance), deposit: num(cp.deposit),
    contracts: arr(cp.Contract).map(ct => {
      const parsed = contractFromName(ct.name)
      return {
        id: str(ct.id), name: str(ct.name),
        number: str(ct.number) || parsed.number, date: onecDate(ct.date) || parsed.date, kind: str(ct.kind) || parsed.kind,
        debt: num(ct.debt), advance: num(ct.advance), deposit: num(ct.deposit),
        docs: arr(ct.Doc).filter(x => str(x.id)).map(x => ({
          id: str(x.id), type: str(x.type), number: str(x.number), date: onecDate(x.date),
          debt: num(x.debt), advance: num(x.advance), account: str(x.account),
          lines: arr(x.Line).map(l => ({ item: str(l.item), itemCode: str(l.itemCode), account: str(l.account), amount: num(l.amount) })),
        })),
      }
    }),
    operations: arr(cp.Op).filter(o => str(o.id)).map(o => ({
      id: str(o.id), kind: str(o.kind), type: str(o.type), number: str(o.number), date: onecDate(o.date),
      contractId: str(o.contractId), charged: num(o.charged), paid: num(o.paid),
    })),
  }))
  return { meta, counterparties }
}

/** Компактный вид для загрузки в базу (onec_stage): без истории операций. */
export function toStagePayload(parsed, source = 'http') {
  return {
    source, meta: parsed.meta,
    counterparties: parsed.counterparties.map(({ operations, ...cp }) => ({ ...cp, ops_count: operations.length })),
  }
}
