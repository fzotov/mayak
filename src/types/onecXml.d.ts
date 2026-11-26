// Типы разборщика выгрузки 1С (api/_lib/onecXml.js — JavaScript, общий для сервера и браузера).
// Описание лежит здесь, а не рядом с модулем: экран «Переход с 1С» импортирует его по относительному пути.
declare module '*/_lib/onecXml.js' {
  export type OnecMeta = {
    generated: string
    asOf: string | null
    operationsFrom: string | null
    org: string
    orgInn: string
    /** '1' — старая выгрузка, '2' — со строками номенклатуры. */
    version: string
  }
  export type OnecDocLine = { item: string; itemCode: string; account: string; amount: number }
  export type OnecDoc = {
    id: string; type: string; number: string; date: string | null
    debt: number; advance: number; account: string
    lines: OnecDocLine[]
  }
  export type OnecContract = {
    id: string; name: string; number: string | null; date: string | null; kind: string
    debt: number; advance: number; deposit: number
    docs: OnecDoc[]
  }
  export type OnecOperation = {
    id: string; kind: string; type: string; number: string; date: string | null
    contractId: string; charged: number; paid: number
  }
  export type OnecCounterparty = {
    id: string; name: string; inn: string; kpp: string
    debt: number; advance: number; deposit: number
    contracts: OnecContract[]
    operations: OnecOperation[]
  }
  export type OnecParsed = { meta: OnecMeta; counterparties: OnecCounterparty[] }
  export type OnecStagePayload = {
    source: string
    meta: OnecMeta
    counterparties: (Omit<OnecCounterparty, 'operations'> & { ops_count: number })[]
  }

  export function onecDate(v: unknown): string | null
  export function contractFromName(name: unknown): { number: string | null; date: string | null; kind: string }
  export function parseDebtsXml(xml: string): OnecParsed
  export function toStagePayload(parsed: OnecParsed, source?: string): OnecStagePayload
}
