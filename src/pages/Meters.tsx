import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const TYPES: Record<string, {label:string;icon:string;unit:string}> = {
  electricity: {label:'Электричество',icon:'⚡',unit:'кВт·ч'},
  cold_water: {label:'Холодная вода',icon:'💧',unit:'м³'},
  hot_water: {label:'Горячая вода',icon:'🔥',unit:'м³'},
  heat: {label:'Тепло',icon:'🌡',unit:'Гкал'},
  gas: {label:'Газ',icon:'🔆',unit:'м³'},
  boiler: {label:'Бойлер',icon:'♨️',unit:'м³'},
  common_electricity: {label:'Общий эл.',icon:'⚡',unit:'кВт·ч'},
  common_water: {label:'Общий вода',icon:'💧',unit:'м³'},
  common_heat: {label:'Общее тепло',icon:'🌡',unit:'Гкал'},
}

const SI: React.CSSProperties = {width:'100%',border:'1px solid #e5e7eb',borderRadius:6,padding:'7px 10px',fontSize:14,fontFamily:'inherit',outline:'none',boxSizing:'border-box'}
const SL: React.CSSProperties = {fontSize:12,color:'#6b7280',marginBottom:4,display:'block',fontWeight:500}

export default function MetersPage() {
  const [meters, setMeters] = useState<any[]>([])
  const [units, setUnits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [view, setView] = useState<'list'|'edit'|'readings'>('list')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{data:m},{data:u}] = await Promise.all([
      supabase.from('meters').select('*'),
      supabase.from('units').select('id,number').order('number')
    ])
    setMeters(m||[])
    setUnits(u||[])
    setLoading(false)
  }

  if (loading) return <div style={{padding:20,color:'#9ca3af'}}>Загрузка...</div>

  if (view === 'edit') return <MeterForm meter={selected} units={units} onBack={() => { setView('list'); load() }} />
  if (view === 'readings' && selected) return <ReadingsView meter={selected} onBack={() => { setView('list'); load() }} />

  return (
    <div>
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:16}}>
        <button onClick={() => { setSelected(null); setView('edit') }} style={{padding:'7px 16px',border:'none',borderRadius:6,background:'#111',color:'#fff',fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>
          + Добавить счётчик
        </button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))',gap:12}}>
        {meters.map(m => {
          const t = TYPES[m.type] || {label:m.type,icon:'📊',unit:''}
          return (
            <div key={m.id} style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:10,padding:16}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:22}}>{t.icon}</span>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:'#111'}}>{t.label}</div>
                    <div style={{fontSize:12,color:'#6b7280'}}>№{m.number||m.serial||'—'}</div>
                  </div>
                </div>
                <button onClick={() => { setSelected(m); setView('edit') }} style={{border:'none',background:'#f3f4f6',borderRadius:6,padding:'4px 8px',fontSize:12,color:'#6b7280',cursor:'pointer'}}>✎</button>
              </div>
              {m.tariff > 0 && <div style={{fontSize:12,color:'#6b7280',marginBottom:8}}>Тариф: {m.tariff} ₽/{t.unit}</div>}
              <button onClick={() => { setSelected(m); setView('readings') }} style={{width:'100%',padding:'7px',borderRadius:6,border:'none',background:'#111',color:'#fff',fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>
                Показания
              </button>
            </div>
          )
        })}
        {meters.length === 0 && <div style={{color:'#9ca3af',fontSize:14}}>Счётчики не добавлены</div>}
      </div>
    </div>
  )
}

function MeterForm({meter, units, onBack}: {meter:any; units:any[]; onBack:()=>void}) {
  const [form, setForm] = useState({
    number: meter?.number||meter?.serial||'',
    type: meter?.type||'electricity',
    unit_id: meter?.unit_id||'',
    location: meter?.location||'office',
    area: meter?.area||0,
    tariff: meter?.tariff||0,
    heat_tariff: meter?.heat_tariff||0,
    notes: meter?.notes||'',
  })
  const [saving, setSaving] = useState(false)
  const set = (k:string,v:any) => setForm(f=>({...f,[k]:v}))

  async function save() {
    if (!form.number) return alert('Введите номер счётчика')
    setSaving(true)
    const p = {...form, serial: form.number, unit_id: form.unit_id||null}
    if (meter?.id) await supabase.from('meters').update(p).eq('id', meter.id)
    else await supabase.from('meters').insert(p)
    setSaving(false)
    onBack()
  }

  async function remove() {
    if (!meter?.id || !confirm('Удалить счётчик?')) return
    await supabase.from('meters').delete().eq('id', meter.id)
    onBack()
  }

  const isHeat = form.type === 'heat' || form.type === 'common_heat'

  return (
    <div style={{maxWidth:500}}>
      <button onClick={onBack} style={{border:'none',background:'none',color:'#6b7280',fontSize:14,cursor:'pointer',marginBottom:16,fontFamily:'inherit'}}>← Назад</button>
      <div style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:10,padding:20,display:'flex',flexDirection:'column',gap:14}}>
        <div><label style={SL}>Номер счётчика *</label><input style={SI} value={form.number} onChange={e=>set('number',e.target.value)} placeholder="12345678"/></div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div><label style={SL}>Тип</label>
            <select style={SI} value={form.type} onChange={e=>set('type',e.target.value)}>
              {Object.entries(TYPES).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
            </select>
          </div>
          <div><label style={SL}>Расположение</label>
            <select style={SI} value={form.location} onChange={e=>set('location',e.target.value)}>
              <option value="office">Офис</option>
              <option value="common">Общий</option>
            </select>
          </div>
        </div>
        <div><label style={SL}>Офис</label>
          <select style={SI} value={form.unit_id} onChange={e=>set('unit_id',e.target.value)}>
            <option value="">— Не привязан</option>
            {units.map(u=><option key={u.id} value={u.id}>Офис {u.number}</option>)}
          </select>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div><label style={SL}>Тариф (₽/{TYPES[form.type]?.unit||'ед.'})</label><input style={SI} type="number" value={form.tariff||''} onChange={e=>set('tariff',Number(e.target.value))}/></div>
          {isHeat && <div><label style={SL}>Тариф тепла (₽/Гкал·м²)</label><input style={SI} type="number" value={form.heat_tariff||''} onChange={e=>set('heat_tariff',Number(e.target.value))}/></div>}
          {isHeat && <div><label style={SL}>Площадь (м²)</label><input style={SI} type="number" value={form.area||''} onChange={e=>set('area',Number(e.target.value))}/></div>}
        </div>
        <div><label style={SL}>Заметки</label><textarea style={{...SI,height:60,resize:'none'}} value={form.notes} onChange={e=>set('notes',e.target.value)}/></div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={save} disabled={saving} style={{flex:1,padding:'8px',borderRadius:6,border:'none',background:'#111',color:'#fff',fontSize:14,fontWeight:500,cursor:'pointer',fontFamily:'inherit',opacity:saving?0.6:1}}>
            {saving?'Сохранение...':'Сохранить'}
          </button>
          {meter && <button onClick={remove} style={{padding:'8px 14px',borderRadius:6,border:'none',background:'#fee2e2',color:'#ef4444',fontSize:14,cursor:'pointer',fontFamily:'inherit'}}>Удалить</button>}
          <button onClick={onBack} style={{padding:'8px 14px',borderRadius:6,border:'1px solid #e5e7eb',background:'#fff',color:'#6b7280',fontSize:14,cursor:'pointer',fontFamily:'inherit'}}>Отмена</button>
        </div>
      </div>
    </div>
  )
}

function ReadingsView({meter, onBack}: {meter:any; onBack:()=>void}) {
  const [readings, setReadings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({period: new Date().toISOString().slice(0,7)+'-01', prev_value:0, curr_value:0, notes:''})
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const t = TYPES[meter.type] || {label:meter.type,icon:'📊',unit:''}

  useEffect(() => { loadReadings() }, [])

  async function loadReadings() {
    setLoading(true)
    const {data} = await supabase.from('meter_readings').select('*').eq('meter_id',meter.id).order('period',{ascending:false})
    setReadings(data||[])
    if (data && data.length > 0) setForm(f=>({...f, prev_value: data[0].curr_value}))
    setLoading(false)
  }

  const consumption = Math.max(0, form.curr_value - form.prev_value)
  const amount = meter.type === 'heat'
    ? consumption * (meter.heat_tariff||0) * (meter.area||1)
    : consumption * (meter.tariff||0)

  async function save() {
    setSaving(true)
    await supabase.from('meter_readings').insert({
      meter_id: meter.id,
      period: form.period,
      prev_value: form.prev_value,
      curr_value: form.curr_value,
      consumption,
      amount,
      notes: form.notes
    })
    setSaving(false)
    setShowAdd(false)
    loadReadings()
  }

  async function del(id:string) {
    if (!confirm('Удалить?')) return
    await supabase.from('meter_readings').delete().eq('id',id)
    loadReadings()
  }

  return (
    <div>
      <button onClick={onBack} style={{border:'none',background:'none',color:'#6b7280',fontSize:14,cursor:'pointer',marginBottom:16,fontFamily:'inherit'}}>← Назад</button>
      <div style={{marginBottom:8}}>
        <span style={{fontSize:20}}>{t.icon}</span>
        <span style={{fontSize:16,fontWeight:600,marginLeft:8}}>{t.label} №{meter.number||meter.serial}</span>
        <span style={{fontSize:13,color:'#6b7280',marginLeft:8}}>Тариф: {meter.tariff} ₽/{t.unit}</span>
      </div>

      {!showAdd ? (
        <button onClick={()=>setShowAdd(true)} style={{padding:'7px 16px',border:'none',borderRadius:6,background:'#111',color:'#fff',fontSize:13,cursor:'pointer',fontFamily:'inherit',marginBottom:16}}>
          + Внести показания
        </button>
      ) : (
        <div style={{background:'#f9fafb',border:'1px solid #e5e7eb',borderRadius:8,padding:16,marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:600,marginBottom:12}}>Новые показания</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:10}}>
            <div><label style={SL}>Период</label><input style={SI} type="month" value={form.period.slice(0,7)} onChange={e=>setForm(f=>({...f,period:e.target.value+'-01'}))}/></div>
            <div><label style={SL}>Предыдущее</label><input style={SI} type="number" value={form.prev_value} onChange={e=>setForm(f=>({...f,prev_value:Number(e.target.value)}))}/></div>
            <div><label style={SL}>Текущее</label><input style={SI} type="number" value={form.curr_value} onChange={e=>setForm(f=>({...f,curr_value:Number(e.target.value)}))}/></div>
          </div>
          <div style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:6,padding:10,marginBottom:10,display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div><div style={{fontSize:11,color:'#6b7280'}}>Расход</div><div style={{fontSize:16,fontWeight:600}}>{consumption.toFixed(2)} {t.unit}</div></div>
            <div><div style={{fontSize:11,color:'#6b7280'}}>К оплате</div><div style={{fontSize:16,fontWeight:600}}>{amount.toLocaleString('ru')} ₽</div></div>
          </div>
          <div style={{marginBottom:10}}><label style={SL}>Заметка</label><input style={SI} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></div>
          <div style={{marginBottom:10}}>
            <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}}/>
            <button onClick={()=>fileRef.current?.click()} style={{padding:'6px 12px',borderRadius:6,border:'1px solid #e5e7eb',background:'#fff',fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>📷 Фото показаний</button>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={save} disabled={saving} style={{padding:'7px 16px',borderRadius:6,border:'none',background:'#111',color:'#fff',fontSize:13,cursor:'pointer',fontFamily:'inherit',opacity:saving?0.6:1}}>
              {saving?'Сохранение...':'Сохранить'}
            </button>
            <button onClick={()=>setShowAdd(false)} style={{padding:'7px 14px',borderRadius:6,border:'1px solid #e5e7eb',background:'#fff',color:'#6b7280',fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>Отмена</button>
          </div>
        </div>
      )}

      {loading ? <div style={{color:'#9ca3af',fontSize:14}}>Загрузка...</div> : (
        <div style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:8,overflow:'hidden'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:14}}>
            <thead>
              <tr style={{background:'#f9fafb',borderBottom:'1px solid #e5e7eb'}}>
                {['Период','Пред.','Тек.','Расход','Сумма','Заметка',''].map(h=>(
                  <th key={h} style={{padding:'9px 12px',textAlign:'left',fontWeight:500,color:'#6b7280',fontSize:12}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {readings.length === 0 ? (
                <tr><td colSpan={7} style={{padding:16,textAlign:'center',color:'#9ca3af',fontSize:13}}>Показаний нет</td></tr>
              ) : readings.map(r=>(
                <tr key={r.id} style={{borderBottom:'1px solid #f3f4f6'}}>
                  <td style={{padding:'9px 12px',color:'#374151'}}>{new Date(r.period).toLocaleDateString('ru',{month:'long',year:'numeric'})}</td>
                  <td style={{padding:'9px 12px',color:'#6b7280'}}>{r.prev_value}</td>
                  <td style={{padding:'9px 12px',color:'#6b7280'}}>{r.curr_value}</td>
                  <td style={{padding:'9px 12px',fontWeight:500,color:'#111'}}>{r.consumption} {t.unit}</td>
                  <td style={{padding:'9px 12px',fontWeight:600,color:'#111'}}>{Number(r.amount).toLocaleString('ru')} ₽</td>
                  <td style={{padding:'9px 12px',color:'#9ca3af',fontSize:12}}>{r.notes||'—'}</td>
                  <td style={{padding:'9px 12px'}}><button onClick={()=>del(r.id)} style={{border:'none',background:'none',color:'#ef4444',fontSize:12,cursor:'pointer'}}>Удалить</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
