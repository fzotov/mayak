// ─── Геометрия планов 2 и 3 этажей БЦ «Маяк» ─────────────────────────────────
// Источник: rooms.json — исходное изображение 2048×1150.
// Масштаб 0.574, сдвиг: SVG(15,15) ← original(64,27)
//   svgX = 15 + (origX - 64) * 0.574
//   svgY = 15 + (origY - 27) * 0.574
// Используется и в админке (План этажей), и на публичном сайте.
// ─────────────────────────────────────────────────────────────────────────────

import { C } from '../components/ui'

export type Room = { id: string; number: string; area: number; x: number; y: number; w: number; h: number }

// Цвета плана — токены темы (светлая и тёмная), без жёстких значений.
export const OCC  = C.amberBg
export const FREE = C.greenBg
export const SEL  = C.accent
export const CORR = C.hover
export const WALL = C.lineStrong
export const BLUE = C.accent
export const BRD  = C.muted
const FLOOR = C.card2
const BLOCK = C.card
const STAIR = C.hover
const WC    = C.bg
export const W = 900, H = 505

// ── F2 rooms (exact from rooms.json, scaled × 0.574) ────────────────────────
export const F2: Room[] = [
  // top row
  { id:'201', number:'201,202', area:38.30, x:15,  y:15,  w:113, h:124 },
  { id:'203', number:'203',     area:24.10, x:169, y:16,  w:82,  h:123 },
  { id:'204', number:'204',     area:21.60, x:252, y:16,  w:86,  h:123 },
  { id:'205', number:'205',     area:19.70, x:337, y:16,  w:82,  h:123 },
  { id:'206', number:'206',     area:24.10, x:419, y:16,  w:84,  h:123 },
  { id:'207', number:'207',     area:26.20, x:503, y:16,  w:87,  h:123 },
  { id:'208', number:'208',     area:21.82, x:590, y:16,  w:83,  h:123 },
  { id:'209', number:'209',     area:25.15, x:673, y:16,  w:87,  h:123 },
  // left column
  { id:'224', number:'224',  area:21.20, x:52,  y:178, w:115, h:72  },
  { id:'223', number:'223',  area:23.10, x:52,  y:251, w:115, h:71  },
  // inner top row (y=178 h=72)
  { id:'226', number:'226',  area:14.40, x:212, y:178, w:82,  h:72  },
  { id:'227', number:'227',  area:10.20, x:293, y:178, w:54,  h:72  },
  { id:'228', number:'228',  area:10.10, x:347, y:178, w:55,  h:72  },
  { id:'229', number:'229',  area:21.30, x:403, y:178, w:118, h:72  },
  { id:'230', number:'230',  area:44.85, x:520, y:178, w:239, h:72  },
  // inner bottom row (y=251 h=71)
  { id:'231',  number:'231',  area:12.50, x:212, y:251, w:82,  h:71  },
  { id:'231a', number:'231А', area:10.20, x:293, y:251, w:54,  h:71  },
  { id:'231b', number:'231Б', area:10.30, x:347, y:251, w:55,  h:71  },
  { id:'232',  number:'232',  area:16.60, x:403, y:251, w:86,  h:71  },
  { id:'232a', number:'232А', area:16.87, x:488, y:251, w:87,  h:71  },
  { id:'233',  number:'233',  area:13.90, x:575, y:251, w:74,  h:71  },
  { id:'234',  number:'234',  area:12.20, x:649, y:251, w:57,  h:71  },
  // 213 — right side, below WC (orig y=525)
  { id:'213',  number:'213',  area:14.80, x:811, y:301, w:63,  h:97  },
  // bottom row
  { id:'221', number:'221',  area:25.00, x:167, y:366, w:83,  h:119 },
  { id:'220', number:'220',  area:23.10, x:250, y:366, w:87,  h:119 },
  { id:'219', number:'219',  area:18.10, x:337, y:366, w:81,  h:119 },
  { id:'218', number:'218',  area:23.56, x:418, y:366, w:80,  h:119 },
  { id:'217', number:'217',  area:24.20, x:498, y:366, w:84,  h:119 },
  { id:'216', number:'216',  area:25.56, x:582, y:366, w:82,  h:119 },
  { id:'215', number:'215',  area:25.40, x:664, y:366, w:95,  h:119 },
  { id:'214', number:'214',  area:21.50, x:762, y:398, w:113, h:87  },
]

// ── F3 — same structural layout, 3xx numbers ─────────────────────────────────
export const F3: Room[] = [
  { id:'301', number:'301,302', area:38.20, x:15,  y:15,  w:113, h:124 },
  { id:'303', number:'303',     area:24.30, x:169, y:16,  w:82,  h:123 },
  { id:'304', number:'304',     area:21.90, x:252, y:16,  w:86,  h:123 },
  { id:'305', number:'305',     area:20.00, x:337, y:16,  w:82,  h:123 },
  { id:'306', number:'306',     area:23.80, x:419, y:16,  w:84,  h:123 },
  { id:'307', number:'307',     area:26.00, x:503, y:16,  w:87,  h:123 },
  { id:'308', number:'308',     area:21.90, x:590, y:16,  w:83,  h:123 },
  { id:'309', number:'309',     area:24.90, x:673, y:16,  w:87,  h:123 },
  { id:'324', number:'324',  area:21.20, x:52,  y:178, w:115, h:72  },
  { id:'323', number:'323',  area:23.00, x:52,  y:251, w:115, h:71  },
  // 326А — large room spans both inner rows on left (40.4m²)
  { id:'326a',number:'326А', area:40.40, x:212, y:178, w:104, h:144 },
  // inner top (right of 326А)
  { id:'326', number:'326',  area:12.90, x:317, y:178, w:57,  h:72  },
  { id:'327', number:'327',  area:21.10, x:375, y:178, w:80,  h:72  },
  { id:'328', number:'328',  area:21.10, x:456, y:178, w:80,  h:72  },
  { id:'329', number:'329',  area:22.20, x:537, y:178, w:84,  h:72  },
  // inner bottom (right of 326А)
  { id:'326b',number:'326Б', area:17.30, x:317, y:251, w:57,  h:71  },
  { id:'330', number:'330',  area:15.65, x:375, y:251, w:58,  h:71  },
  { id:'330a',number:'330А', area:17.45, x:434, y:251, w:64,  h:71  },
  { id:'331', number:'331',  area:13.60, x:499, y:251, w:50,  h:71  },
  { id:'332', number:'332',  area:12.20, x:550, y:251, w:71,  h:71  },
  { id:'313', number:'313',  area:14.80, x:811, y:301, w:63,  h:97  },
  { id:'321', number:'321',  area:25.00, x:167, y:366, w:83,  h:119 },
  { id:'320', number:'320',  area:23.50, x:250, y:366, w:87,  h:119 },
  { id:'319', number:'319',  area:18.60, x:337, y:366, w:81,  h:119 },
  { id:'318', number:'318',  area:23.90, x:418, y:366, w:80,  h:119 },
  { id:'317', number:'317',  area:22.50, x:498, y:366, w:84,  h:119 },
  { id:'316', number:'316',  area:26.00, x:582, y:366, w:82,  h:119 },
  { id:'315', number:'315',  area:25.90, x:664, y:366, w:95,  h:119 },
  { id:'314', number:'314',  area:21.50, x:762, y:398, w:113, h:87  },
]

export function roomsOfFloor(floor: number): Room[] {
  return floor === 2 ? F2 : F3
}

/** Все помещения 2 и 3 этажей по плану. */
export const ALL_ROOMS: { floor: number; room: Room }[] = [
  ...F2.map(room => ({ floor: 2, room })),
  ...F3.map(room => ({ floor: 3, room })),
]

/**
 * Приводит номер помещения к каноническому ключу: «201,202» / «201.202» / «201 202» → «201202»,
 * «231А» / «231а» → «231а». Нужно, чтобы связать план с таблицей units, где номера записаны по-разному.
 */
export function unitKey(number: string | null | undefined): string {
  return (number || '')
    .toLowerCase()
    .replace(/[\s.,;/-]+/g, '')
    .replace(/a/g, 'а').replace(/b/g, 'б').replace(/c/g, 'с').replace(/e/g, 'е')
    .trim()
}

/**
 * Все варианты ключа для помещения: «201,202» → ['201202', '201', '202'].
 * В units один и тот же офис может быть записан и как «201.202», и как «201».
 */
export function unitKeys(number: string | null | undefined): string[] {
  const raw = (number || '').trim()
  if (!raw) return []
  const parts = raw.split(/[,;/]+/).map(unitKey).filter(Boolean)
  const whole = unitKey(raw)
  return Array.from(new Set([whole, ...parts]))
}

/** Лестничный марш. */
export function Stair({ x, y, w, h, label = 'лестница' }: { x: number; y: number; w: number; h: number; label?: string }) {
  const id = `sc${x}${y}`
  const lines: React.ReactNode[] = []
  for (let d = -h; d < w + h; d += 10)
    lines.push(<line key={d}
      x1={x + Math.max(0, d)} y1={d < 0 ? y - d : y}
      x2={x + Math.min(w, d + h)} y2={d + h > w ? y + h - (d + h - w) : y + h}
      style={{ stroke: C.faint }} strokeWidth="0.8" />)
  return (
    <g>
      <defs><clipPath id={id}><rect x={x} y={y} width={w} height={h} /></clipPath></defs>
      <rect x={x} y={y} width={w} height={h} style={{ fill: STAIR, stroke: BRD }} strokeWidth="2" />
      <g clipPath={`url(#${id})`}>{lines}</g>
      <text x={x + w / 2} y={y + h / 2 + 4} textAnchor="middle" fontSize="8" style={{ fill: C.muted }}>{label}</text>
    </g>
  )
}

/** Несущие стены, коридоры, санузлы, лестницы и лифт — общий «фон» обоих этажей. */
export function FloorChrome() {
  return (
    <>
      <rect x={1} y={1} width={W - 2} height={H - 2} style={{ fill: FLOOR }} />
      <rect x={15}  y={15}  width={859} height={124} style={{ fill: BLOCK, stroke: BRD }} strokeWidth="2.5" />
      <rect x={52}  y={178} width={822} height={144} style={{ fill: BLOCK, stroke: BRD }} strokeWidth="2.5" />
      <rect x={15}  y={366} width={859} height={119} style={{ fill: BLOCK, stroke: BRD }} strokeWidth="2.5" />
      <rect x={762} y={366} width={113} height={119} style={{ fill: BLOCK, stroke: BRD }} strokeWidth="1" />

      <rect x={15}  y={139} width={37} height={227} style={{ fill: WALL, stroke: BRD }} strokeWidth="1.5" />
      <rect x={760} y={139} width={51} height={162} style={{ fill: WALL, stroke: BRD }} strokeWidth="1.5" />

      <rect x={52} y={139} width={708} height={39} style={{ fill: CORR }} />
      <line x1={52} y1={139} x2={760} y2={139} style={{ stroke: BRD }} strokeWidth="1" />
      <line x1={52} y1={178} x2={167} y2={178} style={{ stroke: BRD }} strokeWidth="1" />
      <rect x={52} y={322} width={708} height={44} style={{ fill: CORR }} />
      <line x1={52}  y1={322} x2={760} y2={322} style={{ stroke: BRD }} strokeWidth="1" />
      <line x1={167} y1={366} x2={760} y2={366} style={{ stroke: BRD }} strokeWidth="1" />
      <rect x={167} y={178} width={45} height={144} style={{ fill: WALL, stroke: BRD }} strokeWidth="1" />

      <rect x={759} y={178} width={52}  height={72} style={{ fill: WC, stroke: BRD }} strokeWidth="1" />
      <rect x={706} y={251} width={105} height={71} style={{ fill: WC, stroke: BRD }} strokeWidth="1" />
      <text x={772} y={220} textAnchor="middle" fontSize="14" fontWeight="600" style={{ fill: C.faint }}>М</text>
      <text x={796} y={220} textAnchor="middle" fontSize="14" fontWeight="600" style={{ fill: C.faint }}>Ж</text>
      <text x={756} y={300} textAnchor="middle" fontSize="8" style={{ fill: C.faint }}>санузел</text>

      <rect x={15}  y={10}  width={745} height={5}   style={{ fill: BLUE }} rx="1" />
      <rect x={167} y={485} width={594} height={5}   style={{ fill: BLUE }} rx="1" />
      <rect x={47}  y={178} width={5}   height={144} style={{ fill: BLUE }} rx="1" />

      <Stair x={760} y={15}  w={114} h={163} />
      <Stair x={15}  y={366} w={152} h={119} />
    </>
  )
}
