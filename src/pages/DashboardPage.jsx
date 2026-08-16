import { useState, useMemo } from 'react'
import { TrendingUp, Users, Package, RefreshCw } from 'lucide-react'
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

export default function DashboardPage() {
  const [startMonth, setStartMonth] = useState(1)
  const [startYear,  setStartYear]  = useState(CURRENT_YEAR)
  const [endMonth,   setEndMonth]   = useState(12)
  const [endYear,    setEndYear]    = useState(CURRENT_YEAR)

  const { data: rows = [], isLoading } = useForecastPivotAll()
  const { data: customers = [] }       = useCustomers()
  const { data: rotations = [] }       = useRotations()

  // Colonne del range selezionato
  const cols = useMemo(
    () => buildMonthRange(startYear, startMonth, endYear, endMonth),
    [startYear, startMonth, endYear, endMonth]
  )
  const numMonths = cols.length

  // Righe forecast filtrate per il range selezionato (solo anni nel range)
  const yearsInRange = useMemo(() => [...new Set(cols.map(c => c.year))], [cols])
  const rangeRows = useMemo(
    () => rows.filter(r => yearsInRange.includes(r.year)),
    [rows, yearsInRange]
  )

  // Pezzi e fatturato nel range (solo mesi selezionati)
  const { totalQty, totalRevenue } = useMemo(() => {
    let qty = 0, rev = 0
    for (const r of rangeRows) {
      for (const c of cols) {
        if (c.year === r.year) {
          const q = Number(r[c.key] || 0)
          qty += q
          rev += q * Number(r.avg_price_snapshot || 0)
        }
      }
    }
    return { totalQty: qty, totalRevenue: rev }
  }, [rangeRows, cols])

  // KPI fatturato anno corrente per card (sempre anno corrente)
  const currentYearRows = rows.filter(r => r.year === CURRENT_YEAR)

  // Rotazioni in scadenza prossimi 60 giorni (fisso, non filtrato)
  const today    = new Date()
  const in60days = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000)
  const expiringRotations = rotations
    .filter(r => { const end = new Date(r.period_end); return end >= today && end <= in60days })
    .sort((a, b) => new Date(a.period_end) - new Date(b.period_end))

  // Grafico mensile sul range selezionato
  const monthlyData = cols.map(c => {
    const colRows = rows.filter(r => r.year === c.year)
    const rev = colRows.reduce((s, r) => s + Number(r[c.key] || 0) * Number(r.avg_price_snapshot || 0), 0)
    return { ...c, rev }
  })
  const maxRev = Math.max(...monthlyData.map(m => m.rev), 1)

  // Top clienti per fatturato nel range
  const byCustomer = useMemo(() => Object.values(
    rangeRows.reduce((acc, r) => {
      if (!acc[r.company_name]) acc[r.company_name] = { name: r.company_name, revenue: 0, qty: 0 }
      for (const c of cols) {
        if (c.year === r.year) {
          const q = Number(r[c.key] || 0)
          acc[r.company_name].qty     += q
          acc[r.company_name].revenue += q * Number(r.avg_price_snapshot || 0)
        }
      }
      return acc
    }, {})
  ).sort((a, b) => b.revenue - a.revenue), [rangeRows, cols])

  // Top prodotti per pezzi nel range + rotazione media mensile per prodotto
  const byProduct = useMemo(() => {
    // Mappa product_description -> totale pezzi nel range
    const prodMap = {}
    for (const r of rangeRows) {
      if (!prodMap[r.product_description]) prodMap[r.product_description] = { name: r.product_description, qty: 0 }
      for (const c of cols) {
        if (c.year === r.year) prodMap[r.product_description].qty += Number(r[c.key] || 0)
      }
    }

    // Calcola rotazione media mensile per prodotto dalle rotazioni
    // rotazione media = (num_points × rotation_value) / mesi_per_periodo × mesi_selezionati
    // Semplificato: per ogni rotazione attiva nel range, calcolo pezzi/mese e sommo per prodotto
    const rotProdMap = {} // product description -> { totalPezziMese }
    for (const rot of rotations) {
      const rotStart = new Date(rot.period_start)
      const rotEnd   = new Date(rot.period_end)
      const rangeStart = new Date(startYear, startMonth - 1, 1)
      const rangeEnd   = new Date(endYear, endMonth - 1, 31)
      // Sovrapposizione periodo rotazione e range selezionato
      if (rotEnd < rangeStart || rotStart > rangeEnd) continue
      const stepMonths = { monthly: 1, bimonthly: 2, quarterly: 3, quadrimestral: 4 }[rot.frequency] || 1
      const rotDurationMonths = (rotEnd.getFullYear() - rotStart.getFullYear()) * 12 + (rotEnd.getMonth() - rotStart.getMonth()) + 1
      const numOrders = Math.ceil(rotDurationMonths / stepMonths)
      const pezziPerMese = (rot.num_points * rot.rotation_value * numOrders) / Math.max(rotDurationMonths, 1)
      if (rot.products && Array.isArray(rot.products)) {
        for (const rp of rot.products) {
          // Cerca la descrizione del prodotto nelle righe
          const prodRow = rows.find(r => r.product_id === rp.product_id)
          if (!prodRow) continue
          const desc = prodRow.product_description
          if (!rotProdMap[desc]) rotProdMap[desc] = 0
          rotProdMap[desc] += pezziPerMese
        }
      }
    }

    return Object.values(prodMap)
      .map(p => ({
        ...p,
        rotMedia: rotProdMap[p.name] || 0,
      }))
      .sort((a, b) => b.qty - a.qty)
  }, [rangeRows, cols, rotations, rows, startYear, startMonth, endYear, endMonth])

  // Rotazione media globale nel periodo (da rotazioni)
  const rotazioneMediaGlobale = useMemo(() => {
    if (rotations.length === 0 || numMonths === 0) return 0
    let totalPezziMese = 0
    let count = 0
    for (const rot of rotations) {
      const rotStart = new Date(rot.period_start)
      const rotEnd   = new Date(rot.period_end)
      const rangeStart = new Date(startYear, startMonth - 1, 1)
      const rangeEnd   = new Date(endYear, endMonth - 1, 31)
      if (rotEnd < rangeStart || rotStart > rangeEnd) continue
      const stepMonths = { monthly: 1, bimonthly: 2, quarterly: 3, quadrimestral: 4 }[rot.frequency] || 1
      const rotDurationMonths = (rotEnd.getFullYear() - rotStart.getFullYear()) * 12 + (rotEnd.getMonth() - rotStart.getMonth()) + 1
      const numOrders = Math.ceil(rotDurationMonths / stepMonths)
      const pezziPerMese = (rot.num_points * rot.rotation_value * numOrders) / Math.max(rotDurationMonths, 1)
      totalPezziMese += pezziPerMese
      count++
    }
    return count > 0 ? totalPezziMese / count : 0
  }, [rotations, startYear, startMonth, endYear, endMonth])

  const FREQ = { monthly: 'Mensile', bimonthly: 'Bimestrale', quarterly: 'Trimestrale', quadrimestral: 'Quadrimestrale' }

  const periodLabel = `${MONTHS_SHORT[startMonth-1]} ${startYear} → ${MONTHS_SHORT[endMonth-1]} ${endYear}`

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-4">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text-main)' }}>Dashboard</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-sub)' }}>Riepilogo forecast</p>
      </div>

      {/* Filtro globale periodo */}
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
        <KpiCard icon={TrendingUp} label="Fatturato previsto"     value={fmtEur(totalRevenue)}          sub={periodLabel}                               color="bg-brand-600" />
        <KpiCard icon={Package}    label="Pezzi previsti"         value={fmt(totalQty)}                  sub={periodLabel}                               color="bg-teal-500" />
        <KpiCard icon={Users}      label="Clienti attivi"         value={customers.length}               sub="in anagrafica"                             color="bg-indigo-500" />
        <KpiCard icon={RefreshCw}  label="Rot. media mensile/pdv" value={fmtDec(rotazioneMediaGlobale)}  sub="pezzi/mese per punto vendita"              color="bg-amber-500" />
      </div>

      {/* Grafico mensile */}
      <div className="card p-5 mb-6">
        <h2 className="text-sm font-medium mb-4" style={{ color: 'var(--text-main)' }}>Andamento mensile — fatturato</h2>
        {isLoading ? (
          <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Caricamento…</div>
        ) : (
          <div className="flex items-end gap-1" style={{ height: '160px' }}>
            {monthlyData.map(m => {
              const barH = m.rev > 0 ? Math.max((m.rev / maxRev) * 130, 8) : 0
              return (
                <div key={`${m.year}-${m.month}`} className="flex-1 flex flex-col items-center justify-end gap-1">
                  {m.rev > 0 && (
                    <span style={{ fontSize: '8px', color: '#6b7280', marginBottom: '2px', whiteSpace: 'nowrap' }}>
                      {fmtEur(m.rev)}
                    </span>
                  )}
                  <div style={{ height: `${barH}px`, backgroundColor: 'var(--brand)', borderRadius: '4px 4px 0 0', width: '100%' }} title={fmtEur(m.rev)} />
                  <span className="text-xs text-gray-400">{m.label}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Top clienti + Top prodotti */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-6" style={{ alignItems: 'start' }}>

        {/* Clienti per fatturato */}
        <div className="card p-5">
          <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--text-main)' }}>
            Clienti per fatturato
            <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>({byCustomer.length} totali)</span>
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
                        <span className="text-xs truncate" style={{ color: 'var(--text-main)' }}>{c.name}</span>
                        <span className="text-xs font-medium ml-2 shrink-0" style={{ color: 'var(--text-main)' }}>{fmtEur(c.revenue)}</span>
                      </div>
                      <div className="h-1 rounded mt-1" style={{ backgroundColor: 'var(--border)' }}>
                        <div className="h-1 bg-brand-400 rounded" style={{ width: `${(c.revenue / (byCustomer[0]?.revenue || 1)) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Prodotti per pezzi con rotazione media */}
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
                          {p.rotMedia > 0 && (
                            <span className="text-xs text-amber-500 font-medium" title="Rotazione media mensile/pdv">
                              {fmtDec(p.rotMedia)} rot/mese
                            </span>
                          )}
                          <span className="text-xs font-medium" style={{ color: 'var(--text-main)' }}>{fmt(p.qty)} pz</span>
                        </div>
                      </div>
                      <div className="h-1 rounded mt-1" style={{ backgroundColor: 'var(--border)' }}>
                        <div className="h-1 bg-teal-400 rounded" style={{ width: `${(p.qty / (byProduct[0]?.qty || 1)) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Rotazioni in scadenza — fisso, non filtrato per periodo */}
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
    </div>
  )
}
