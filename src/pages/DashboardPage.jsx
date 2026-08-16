import { useState, useMemo } from 'react'
import { TrendingUp, Users, Package, RefreshCw, X } from 'lucide-react'
import { useForecastPivotAll } from '../hooks/useForecast'
import { useCustomers } from '../hooks/useCustomers'
import { useRotations } from '../hooks/useRotations'

const CURRENT_YEAR  = new Date().getFullYear()
const YEARS         = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 1 + i)
const MONTH_KEYS    = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
const MONTHS_SHORT  = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']

function buildMonthRange(startYear, startMonth, endYear, endMonth) {
  const cols = []
  let y = startYear, m = startMonth
  while (y < endYear || (y === endYear && m <= endMonth)) {
    cols.push({ year: y, month: m, key: MONTH_KEYS[m - 1], label: `${MONTHS_SHORT[m - 1]} ${String(y).slice(2)}` })
    m++
    if (m > 12) { m = 1; y++ }
  }
  return cols
}

function fmtEur(n) {
  return '€ ' + Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmt(n) {
  return Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function fmtDec(n) {
  return Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function delta(curr, prev) {
  if (!prev || prev === 0) return null
  return ((curr - prev) / prev) * 100
}

function DeltaBadge({ curr, prev }) {
  const d = delta(curr, prev)
  if (d === null) return <span style={{ color: 'var(--text-muted)' }} className="text-xs">—</span>
  const positive = d >= 0
  return (
    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${positive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
      {positive ? '+' : ''}{d.toFixed(1)}%
    </span>
  )
}

function KpiCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div>
        <p className="text-sm" style={{ color: 'var(--text-sub)' }}>{label}</p>
        <p className="text-xl font-semibold mt-0.5" style={{ color: 'var(--text-main)' }}>{value}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
      </div>
    </div>
  )
}

function CustomerModal({ customerName, rows, cols, onClose }) {
  const customerRows = rows.filter(r => r.company_name === customerName)
  const totalRevenue = customerRows.reduce((s, r) =>
    s + cols.filter(c => c.year === r.year).reduce((q, c) => q + Number(r[c.key] || 0) * Number(r.avg_price_snapshot || 0), 0), 0)
  const totalQty = customerRows.reduce((s, r) =>
    s + cols.filter(c => c.year === r.year).reduce((q, c) => q + Number(r[c.key] || 0), 0), 0)
  const monthlyData = cols.map(c => {
    const rev = customerRows.filter(r => r.year === c.year).reduce((s, r) => s + Number(r[c.key] || 0) * Number(r.avg_price_snapshot || 0), 0)
    return { ...c, rev }
  })
  const maxRev = Math.max(...monthlyData.map(m => m.rev), 1)
  const byProduct = customerRows.map(r => {
    const qty = cols.filter(c => c.year === r.year).reduce((s, c) => s + Number(r[c.key] || 0), 0)
    const rev = qty * Number(r.avg_price_snapshot || 0)
    return { name: r.product_description, qty, rev }
  }).sort((a, b) => b.rev - a.rev)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" style={{ backgroundColor: 'var(--bg-card)' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h2 className="font-semibold text-lg" style={{ color: 'var(--text-main)' }}>{customerName}</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {MONTHS_SHORT[cols[0]?.month - 1]} {cols[0]?.year} → {MONTHS_SHORT[cols[cols.length-1]?.month - 1]} {cols[cols.length-1]?.year}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--alt-row)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          <div className="grid grid-cols-3 gap-4">
            {[{ label: 'Fatturato', value: fmtEur(totalRevenue) }, { label: 'Pezzi', value: fmt(totalQty) }, { label: 'Prodotti', value: byProduct.length }].map(k => (
              <div key={k.label} className="rounded-lg p-4 border" style={{ backgroundColor: 'var(--alt-row)', borderColor: 'var(--border)' }}>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{k.label}</p>
                <p className="text-lg font-semibold mt-1" style={{ color: 'var(--text-main)' }}>{k.value}</p>
              </div>
            ))}
          </div>
          <div>
            <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--text-main)' }}>Andamento mensile</h3>
            <div className="flex items-end gap-1" style={{ height: '140px' }}>
              {monthlyData.map(m => {
                const barH = m.rev > 0 ? Math.max((m.rev / maxRev) * 110, 8) : 0
                return (
                  <div key={`${m.year}-${m.month}`} className="flex-1 flex flex-col items-center justify-end gap-1">
                    {m.rev > 0 && <span style={{ fontSize: '7px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{fmtEur(m.rev)}</span>}
                    <div style={{ height: `${barH}px`, backgroundColor: 'var(--brand)', borderRadius: '3px 3px 0 0', width: '100%' }} />
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{m.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--text-main)' }}>Prodotti per fatturato</h3>
            <div className="space-y-2">
              {byProduct.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className="text-xs w-5 shrink-0 font-medium" style={{ color: 'var(--text-muted)' }}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <span className="text-xs truncate" style={{ color: 'var(--text-main)' }}>{p.name}</span>
                      <div className="flex items-center gap-3 ml-2 shrink-0">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmt(p.qty)} pz</span>
                        <span className="text-xs font-medium" style={{ color: 'var(--text-main)' }}>{fmtEur(p.rev)}</span>
                      </div>
                    </div>
                    <div className="h-1 rounded mt-1" style={{ backgroundColor: 'var(--border)' }}>
                      <div className="h-1 rounded" style={{ backgroundColor: 'var(--brand)', width: `${(p.rev / (byProduct[0]?.rev || 1)) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [startMonth, setStartMonth]             = useState(1)
  const [startYear,  setStartYear]              = useState(CURRENT_YEAR)
  const [endMonth,   setEndMonth]               = useState(12)
  const [endYear,    setEndYear]                = useState(CURRENT_YEAR)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [confrontoTab, setConfrontoTab]         = useState('clienti')

  const { data: rows = [], isLoading } = useForecastPivotAll()
  const { data: customers = [] }       = useCustomers()
  const { data: rotations = [] }       = useRotations()

  const cols = useMemo(() => buildMonthRange(startYear, startMonth, endYear, endMonth), [startYear, startMonth, endYear, endMonth])
  // Stesso periodo ma anno precedente
  const colsPrev = useMemo(() => buildMonthRange(startYear - 1, startMonth, endYear - 1, endMonth), [startYear, startMonth, endYear, endMonth])

  const yearsInRange     = useMemo(() => [...new Set(cols.map(c => c.year))], [cols])
  const yearsInRangePrev = useMemo(() => [...new Set(colsPrev.map(c => c.year))], [colsPrev])
  const rangeRows        = useMemo(() => rows.filter(r => yearsInRange.includes(r.year)), [rows, yearsInRange])
  const rangeRowsPrev    = useMemo(() => rows.filter(r => yearsInRangePrev.includes(r.year)), [rows, yearsInRangePrev])

  function calcRevForRows(rowSet, colSet) {
    let rev = 0
    for (const r of rowSet) {
      for (const c of colSet) {
        if (c.year === r.year) rev += Number(r[c.key] || 0) * Number(r.avg_price_snapshot || 0)
      }
    }
    return rev
  }
  function calcQtyForRows(rowSet, colSet) {
    let qty = 0
    for (const r of rowSet) {
      for (const c of colSet) {
        if (c.year === r.year) qty += Number(r[c.key] || 0)
      }
    }
    return qty
  }

  const totalRevenue = useMemo(() => calcRevForRows(rangeRows, cols), [rangeRows, cols])
  const totalQty     = useMemo(() => calcRevForRows(rangeRows, cols) && calcQtyForRows(rangeRows, cols), [rangeRows, cols])

  const today    = new Date()
  const in60days = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000)
  const expiringRotations = rotations
    .filter(r => { const end = new Date(r.period_end); return end >= today && end <= in60days })
    .sort((a, b) => new Date(a.period_end) - new Date(b.period_end))

  const monthlyData = cols.map(c => {
    const rev = rows.filter(r => r.year === c.year).reduce((s, r) => s + Number(r[c.key] || 0) * Number(r.avg_price_snapshot || 0), 0)
    return { ...c, rev }
  })
  const maxRev = Math.max(...monthlyData.map(m => m.rev), 1)

  const byCustomer = useMemo(() => {
    const curr = {}, prev = {}
    for (const r of rangeRows) {
      if (!curr[r.company_name]) curr[r.company_name] = 0
      for (const c of cols) if (c.year === r.year) curr[r.company_name] += Number(r[c.key] || 0) * Number(r.avg_price_snapshot || 0)
    }
    for (const r of rangeRowsPrev) {
      if (!prev[r.company_name]) prev[r.company_name] = 0
      for (const c of colsPrev) if (c.year === r.year) prev[r.company_name] += Number(r[c.key] || 0) * Number(r.avg_price_snapshot || 0)
    }
    return Object.keys(curr).map(name => ({ name, curr: curr[name], prev: prev[name] || 0 })).sort((a, b) => b.curr - a.curr)
  }, [rangeRows, rangeRowsPrev, cols, colsPrev])

  const byCustomerForList = useMemo(() => byCustomer.map(c => ({ name: c.name, revenue: c.curr, qty: 0 })), [byCustomer])

  const byProduct = useMemo(() => {
    const curr = {}, prev = {}
    for (const r of rangeRows) {
      if (!curr[r.product_description]) curr[r.product_description] = 0
      for (const c of cols) if (c.year === r.year) curr[r.product_description] += Number(r[c.key] || 0)
    }
    for (const r of rangeRowsPrev) {
      if (!prev[r.product_description]) prev[r.product_description] = 0
      for (const c of colsPrev) if (c.year === r.year) prev[r.product_description] += Number(r[c.key] || 0)
    }
    // Rotazione media
    const rotProdMap = {}
    for (const rot of rotations) {
      const rotStart = new Date(rot.period_start), rotEnd = new Date(rot.period_end)
      const rangeStart = new Date(startYear, startMonth - 1, 1), rangeEnd = new Date(endYear, endMonth - 1, 31)
      if (rotEnd < rangeStart || rotStart > rangeEnd) continue
      const step = { monthly: 1, bimonthly: 2, quarterly: 3, quadrimestral: 4 }[rot.frequency] || 1
      const dur = (rotEnd.getFullYear() - rotStart.getFullYear()) * 12 + (rotEnd.getMonth() - rotStart.getMonth()) + 1
      const ppm = (rot.num_points * rot.rotation_value * Math.ceil(dur / step)) / Math.max(dur, 1)
      if (rot.products) for (const rp of rot.products) {
        const pr = rows.find(r => r.product_id === rp.product_id)
        if (!pr) continue
        if (!rotProdMap[pr.product_description]) rotProdMap[pr.product_description] = 0
        rotProdMap[pr.product_description] += ppm
      }
    }
    return Object.keys(curr).map(name => ({ name, curr: curr[name], prev: prev[name] || 0, rotMedia: rotProdMap[name] || 0 })).sort((a, b) => b.curr - a.curr)
  }, [rangeRows, rangeRowsPrev, cols, colsPrev, rotations, rows, startYear, startMonth, endYear, endMonth])

  const rotazioneMediaGlobale = useMemo(() => {
    let total = 0, count = 0
    for (const rot of rotations) {
      const rotStart = new Date(rot.period_start), rotEnd = new Date(rot.period_end)
      const rangeStart = new Date(startYear, startMonth - 1, 1), rangeEnd = new Date(endYear, endMonth - 1, 31)
      if (rotEnd < rangeStart || rotStart > rangeEnd) continue
      const step = { monthly: 1, bimonthly: 2, quarterly: 3, quadrimestral: 4 }[rot.frequency] || 1
      const dur = (rotEnd.getFullYear() - rotStart.getFullYear()) * 12 + (rotEnd.getMonth() - rotStart.getMonth()) + 1
      total += (rot.num_points * rot.rotation_value * Math.ceil(dur / step)) / Math.max(dur, 1)
      count++
    }
    return count > 0 ? total / count : 0
  }, [rotations, startYear, startMonth, endYear, endMonth])

  const totalRev  = useMemo(() => calcRevForRows(rangeRows, cols), [rangeRows, cols])
  const totalQty2 = useMemo(() => calcQtyForRows(rangeRows, cols), [rangeRows, cols])

  const FREQ = { monthly: 'Mensile', bimonthly: 'Bimestrale', quarterly: 'Trimestrale', quadrimestral: 'Quadrimestrale' }
  const numMonths = cols.length
  const prevLabel = `${MONTHS_SHORT[startMonth-1]} ${startYear-1} → ${MONTHS_SHORT[endMonth-1]} ${endYear-1}`
  const currLabel = `${MONTHS_SHORT[startMonth-1]} ${startYear} → ${MONTHS_SHORT[endMonth-1]} ${endYear}`

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-4">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text-main)' }}>Dashboard</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-sub)' }}>Riepilogo forecast</p>
      </div>

      {/* Filtro globale — selettori a larghezza automatica SEMPRE */}
      <div className="card px-4 py-3 mb-6 flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium" style={{ color: 'var(--text-main)' }}>Periodo:</span>
        <select className="input text-sm" style={{ width: 'auto', minWidth: '80px' }} value={startMonth} onChange={e => setStartMonth(Number(e.target.value))}>
          {MONTHS_SHORT.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
        </select>
        <select className="input text-sm" style={{ width: 'auto', minWidth: '70px' }} value={startYear} onChange={e => setStartYear(Number(e.target.value))}>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <span style={{ color: 'var(--text-muted)' }}>→</span>
        <select className="input text-sm" style={{ width: 'auto', minWidth: '80px' }} value={endMonth} onChange={e => setEndMonth(Number(e.target.value))}>
          {MONTHS_SHORT.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
        </select>
        <select className="input text-sm" style={{ width: 'auto', minWidth: '70px' }} value={endYear} onChange={e => setEndYear(Number(e.target.value))}>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>{numMonths} mes{numMonths === 1 ? 'e' : 'i'}</span>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 mb-6 lg:grid-cols-4">
        <KpiCard icon={TrendingUp} label="Fatturato previsto"     value={fmtEur(totalRev)}              sub={currLabel}                    color="bg-brand-600" />
        <KpiCard icon={Package}    label="Pezzi previsti"         value={fmt(totalQty2)}                sub={currLabel}                    color="bg-teal-500" />
        <KpiCard icon={Users}      label="Clienti attivi"         value={customers.length}              sub="in anagrafica"                color="bg-indigo-500" />
        <KpiCard icon={RefreshCw}  label="Rot. media mensile/pdv" value={fmtDec(rotazioneMediaGlobale)} sub="pezzi/mese per punto vendita" color="bg-amber-500" />
      </div>

      {/* Grafico mensile */}
      <div className="card p-5 mb-6">
        <h2 className="text-sm font-medium mb-4" style={{ color: 'var(--text-main)' }}>Andamento mensile — fatturato</h2>
        {isLoading ? (
          <div className="h-48 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>Caricamento…</div>
        ) : (
          <div className="flex items-end gap-1" style={{ height: '160px' }}>
            {monthlyData.map(m => {
              const barH = m.rev > 0 ? Math.max((m.rev / maxRev) * 130, 8) : 0
              return (
                <div key={`${m.year}-${m.month}`} className="flex-1 flex flex-col items-center justify-end gap-1">
                  {m.rev > 0 && <span style={{ fontSize: '8px', color: 'var(--text-muted)', marginBottom: '2px', whiteSpace: 'nowrap' }}>{fmtEur(m.rev)}</span>}
                  <div style={{ height: `${barH}px`, backgroundColor: 'var(--brand)', borderRadius: '4px 4px 0 0', width: '100%' }} title={fmtEur(m.rev)} />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.label}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Top clienti + Top prodotti */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-6" style={{ alignItems: 'start' }}>
        <div className="card p-5">
          <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--text-main)' }}>
            Clienti per fatturato
            <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>({byCustomer.length} totali · clicca per dettaglio)</span>
          </h2>
          {byCustomer.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nessun dato nel periodo selezionato.</p>
          ) : (
            <div style={{ height: '320px', overflowY: 'scroll' }}>
              <div className="space-y-2 pr-1">
                {byCustomer.map((c, i) => (
                  <div key={c.name} className="flex items-center gap-3">
                    <span className="text-xs font-medium w-5 shrink-0" style={{ color: 'var(--text-muted)' }}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className="text-xs truncate cursor-pointer hover:underline" style={{ color: 'var(--brand)' }}
                          onClick={() => setSelectedCustomer(c.name)}>{c.name}</span>
                        <span className="text-xs font-medium ml-2 shrink-0" style={{ color: 'var(--text-main)' }}>{fmtEur(c.curr)}</span>
                      </div>
                      <div className="h-1 rounded mt-1" style={{ backgroundColor: 'var(--border)' }}>
                        <div className="h-1 bg-brand-400 rounded" style={{ width: `${(c.curr / (byCustomer[0]?.curr || 1)) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--text-main)' }}>
            Prodotti per pezzi
            <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>({byProduct.length} totali)</span>
          </h2>
          {byProduct.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nessun dato nel periodo selezionato.</p>
          ) : (
            <div style={{ height: '320px', overflowY: 'scroll' }}>
              <div className="space-y-2 pr-1">
                {byProduct.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-3">
                    <span className="text-xs font-medium w-5 shrink-0" style={{ color: 'var(--text-muted)' }}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className="text-xs truncate" style={{ color: 'var(--text-main)' }}>{p.name}</span>
                        <div className="flex items-center gap-2 ml-2 shrink-0">
                          {p.rotMedia > 0 && <span className="text-xs text-amber-500 font-medium">{fmtDec(p.rotMedia)} rot/mese</span>}
                          <span className="text-xs font-medium" style={{ color: 'var(--text-main)' }}>{fmt(p.curr)} pz</span>
                        </div>
                      </div>
                      <div className="h-1 rounded mt-1" style={{ backgroundColor: 'var(--border)' }}>
                        <div className="h-1 bg-teal-400 rounded" style={{ width: `${(p.curr / (byProduct[0]?.curr || 1)) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confronto anno precedente */}
      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium" style={{ color: 'var(--text-main)' }}>
            Confronto anno precedente
            <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>{prevLabel} vs {currLabel}</span>
          </h2>
          <div className="flex gap-1">
            {['clienti', 'prodotti'].map(tab => (
              <button key={tab} onClick={() => setConfrontoTab(tab)}
                className="px-3 py-1 rounded text-xs font-medium transition-colors capitalize"
                style={{
                  backgroundColor: confrontoTab === tab ? 'var(--brand)' : 'var(--alt-row)',
                  color: confrontoTab === tab ? 'white' : 'var(--text-sub)',
                }}>
                {tab}
              </button>
            ))}
          </div>
        </div>

        {confrontoTab === 'clienti' ? (
          <div style={{ maxHeight: '320px', overflowY: 'scroll' }}>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                  <th className="text-left py-2 font-medium" style={{ color: 'var(--text-sub)' }}>Cliente</th>
                  <th className="text-right py-2 font-medium" style={{ color: 'var(--text-sub)' }}>{startYear - 1}</th>
                  <th className="text-right py-2 font-medium" style={{ color: 'var(--text-sub)' }}>{startYear}</th>
                  <th className="text-right py-2 font-medium" style={{ color: 'var(--text-sub)' }}>Var. %</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {byCustomer.map(c => (
                  <tr key={c.name}>
                    <td className="py-2 cursor-pointer hover:underline" style={{ color: 'var(--brand)' }}
                      onClick={() => setSelectedCustomer(c.name)}>{c.name}</td>
                    <td className="py-2 text-right" style={{ color: 'var(--text-sub)' }}>{fmtEur(c.prev)}</td>
                    <td className="py-2 text-right font-medium" style={{ color: 'var(--text-main)' }}>{fmtEur(c.curr)}</td>
                    <td className="py-2 text-right"><DeltaBadge curr={c.curr} prev={c.prev} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ maxHeight: '320px', overflowY: 'scroll' }}>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                  <th className="text-left py-2 font-medium" style={{ color: 'var(--text-sub)' }}>Prodotto</th>
                  <th className="text-right py-2 font-medium" style={{ color: 'var(--text-sub)' }}>{startYear - 1} (pz)</th>
                  <th className="text-right py-2 font-medium" style={{ color: 'var(--text-sub)' }}>{startYear} (pz)</th>
                  <th className="text-right py-2 font-medium" style={{ color: 'var(--text-sub)' }}>Var. %</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {byProduct.map(p => (
                  <tr key={p.name}>
                    <td className="py-2" style={{ color: 'var(--text-main)' }}>{p.name}</td>
                    <td className="py-2 text-right" style={{ color: 'var(--text-sub)' }}>{fmt(p.prev)}</td>
                    <td className="py-2 text-right font-medium" style={{ color: 'var(--text-main)' }}>{fmt(p.curr)}</td>
                    <td className="py-2 text-right"><DeltaBadge curr={p.curr} prev={p.prev} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rotazioni in scadenza */}
      <div className="card p-5">
        <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--text-main)' }}>
          Rotazioni in scadenza nei prossimi 60 giorni
          {expiringRotations.length > 0 && (
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
              {expiringRotations.length}
            </span>
          )}
        </h2>
        {expiringRotations.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nessuna rotazione in scadenza nei prossimi 60 giorni.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                <th className="text-left py-2 font-medium" style={{ color: 'var(--text-sub)' }}>Cliente</th>
                <th className="text-left py-2 font-medium" style={{ color: 'var(--text-sub)' }}>Prodotti</th>
                <th className="text-left py-2 font-medium" style={{ color: 'var(--text-sub)' }}>Frequenza</th>
                <th className="text-right py-2 font-medium" style={{ color: 'var(--text-sub)' }}>Scadenza</th>
                <th className="text-right py-2 font-medium" style={{ color: 'var(--text-sub)' }}>Giorni rimanenti</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {expiringRotations.map(r => {
                const end      = new Date(r.period_end)
                const daysLeft = Math.ceil((end - today) / (1000 * 60 * 60 * 24))
                return (
                  <tr key={r.id}>
                    <td className="py-2 font-medium" style={{ color: 'var(--text-main)' }}>{r.company_name}</td>
                    <td className="py-2" style={{ color: 'var(--text-sub)' }}>{r.product_count} prodotti</td>
                    <td className="py-2" style={{ color: 'var(--text-sub)' }}>{FREQ[r.frequency]}</td>
                    <td className="py-2 text-right" style={{ color: 'var(--text-sub)' }}>
                      {end.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </td>
                    <td className="py-2 text-right">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${daysLeft <= 14 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {daysLeft} giorni
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {selectedCustomer && (
        <CustomerModal customerName={selectedCustomer} rows={rangeRows} cols={cols} onClose={() => setSelectedCustomer(null)} />
      )}
    </div>
  )
}
