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

function KpiCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-xl font-semibold text-gray-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
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

  const cols = useMemo(
    () => buildMonthRange(startYear, startMonth, endYear, endMonth),
    [startYear, startMonth, endYear, endMonth]
  )

  const currentYearRows = rows.filter(r => r.year === CURRENT_YEAR)
  const totalQty        = currentYearRows.reduce((s, r) => s + Number(r.total_qty     || 0), 0)
  const totalRevenue    = currentYearRows.reduce((s, r) => s + Number(r.total_revenue || 0), 0)

  const today    = new Date()
  const in60days = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000)
  const expiringRotations = rotations
    .filter(r => { const end = new Date(r.period_end); return end >= today && end <= in60days })
    .sort((a, b) => new Date(a.period_end) - new Date(b.period_end))

  const monthlyData = cols.map(c => {
    const colRows = rows.filter(r => r.year === c.year)
    const rev = colRows.reduce((s, r) => s + Number(r[c.key] || 0) * Number(r.avg_price_snapshot || 0), 0)
    return { ...c, rev }
  })
  const maxRev = Math.max(...monthlyData.map(m => m.rev), 1)

  const byCustomer = Object.values(
    currentYearRows.reduce((acc, r) => {
      if (!acc[r.company_name]) acc[r.company_name] = { name: r.company_name, revenue: 0 }
      acc[r.company_name].revenue += Number(r.total_revenue || 0)
      return acc
    }, {})
  ).sort((a, b) => b.revenue - a.revenue)

  const byProduct = Object.values(
    currentYearRows.reduce((acc, r) => {
      if (!acc[r.product_description]) acc[r.product_description] = { name: r.product_description, qty: 0 }
      acc[r.product_description].qty += Number(r.total_qty || 0)
      return acc
    }, {})
  ).sort((a, b) => b.qty - a.qty)

  const FREQ = { monthly: 'Mensile', bimonthly: 'Bimestrale', quarterly: 'Trimestrale', quadrimestral: 'Quadrimestrale' }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Riepilogo forecast — anno {CURRENT_YEAR}</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 mb-6 lg:grid-cols-4">
        <KpiCard icon={TrendingUp} label="Fatturato previsto" value={fmtEur(totalRevenue)} sub={`Anno ${CURRENT_YEAR}`}                    color="bg-brand-600" />
        <KpiCard icon={Package}    label="Pezzi previsti"     value={fmt(totalQty)}         sub={`Anno ${CURRENT_YEAR}`}                    color="bg-teal-500" />
        <KpiCard icon={Users}      label="Clienti attivi"     value={customers.length}       sub="in anagrafica"                             color="bg-indigo-500" />
        <KpiCard icon={RefreshCw}  label="Rotazioni attive"   value={rotations.length}       sub={`${expiringRotations.length} in scadenza`} color="bg-amber-500" />
      </div>

      {/* Grafico mensile */}
      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-sm font-medium text-gray-700">Andamento mensile — fatturato</h2>
          <div className="flex items-center gap-2">
            <select className="input w-24 text-xs" value={startMonth} onChange={e => setStartMonth(Number(e.target.value))}>
              {MONTHS_SHORT.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
            <select className="input w-20 text-xs" value={startYear} onChange={e => setStartYear(Number(e.target.value))}>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <span className="text-gray-400 text-xs">→</span>
            <select className="input w-24 text-xs" value={endMonth} onChange={e => setEndMonth(Number(e.target.value))}>
              {MONTHS_SHORT.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
            <select className="input w-20 text-xs" value={endYear} onChange={e => setEndYear(Number(e.target.value))}>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
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
                  <div style={{ height: `${barH}px`, backgroundColor: '#6366f1', borderRadius: '4px 4px 0 0', width: '100%' }} title={fmtEur(m.rev)} />
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
          <h2 className="text-sm font-medium text-gray-700 mb-3">
            Clienti per fatturato {CURRENT_YEAR}
            <span className="ml-2 text-xs text-gray-400 font-normal">({byCustomer.length} totali)</span>
          </h2>
          {byCustomer.length === 0 ? (
            <p className="text-sm text-gray-400">Nessun dato.</p>
          ) : (
            <div style={{ height: '320px', overflowY: 'scroll' }}>
              <div className="space-y-2 pr-1">
                {byCustomer.map((c, i) => (
                  <div key={c.name} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-gray-400 w-5 shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-900 truncate">{c.name}</span>
                        <span className="text-xs font-medium text-gray-900 ml-2 shrink-0">{fmtEur(c.revenue)}</span>
                      </div>
                      <div className="h-1 bg-gray-100 rounded mt-1">
                        <div className="h-1 bg-brand-400 rounded" style={{ width: `${(c.revenue / (byCustomer[0]?.revenue || 1)) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Prodotti per pezzi */}
        <div className="card p-5">
          <h2 className="text-sm font-medium text-gray-700 mb-3">
            Prodotti per pezzi {CURRENT_YEAR}
            <span className="ml-2 text-xs text-gray-400 font-normal">({byProduct.length} totali)</span>
          </h2>
          {byProduct.length === 0 ? (
            <p className="text-sm text-gray-400">Nessun dato.</p>
          ) : (
            <div style={{ height: '320px', overflowY: 'scroll' }}>
              <div className="space-y-2 pr-1">
                {byProduct.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-gray-400 w-5 shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-900 truncate">{p.name}</span>
                        <span className="text-xs font-medium text-gray-900 ml-2 shrink-0">{fmt(p.qty)} pz</span>
                      </div>
                      <div className="h-1 bg-gray-100 rounded mt-1">
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

      {/* Rotazioni in scadenza */}
      <div className="card p-5">
        <h2 className="text-sm font-medium text-gray-700 mb-3">
          Rotazioni in scadenza nei prossimi 60 giorni
          {expiringRotations.length > 0 && (
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
              {expiringRotations.length}
            </span>
          )}
        </h2>
        {expiringRotations.length === 0 ? (
          <p className="text-sm text-gray-400">Nessuna rotazione in scadenza nei prossimi 60 giorni.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 font-medium text-gray-500">Cliente</th>
                <th className="text-left py-2 font-medium text-gray-500">Prodotti</th>
                <th className="text-left py-2 font-medium text-gray-500">Frequenza</th>
                <th className="text-right py-2 font-medium text-gray-500">Scadenza</th>
                <th className="text-right py-2 font-medium text-gray-500">Giorni rimanenti</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {expiringRotations.map(r => {
                const end      = new Date(r.period_end)
                const daysLeft = Math.ceil((end - today) / (1000 * 60 * 60 * 24))
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="py-2 font-medium text-gray-900">{r.company_name}</td>
                    <td className="py-2 text-gray-600">{r.product_count} prodotti</td>
                    <td className="py-2 text-gray-600">{FREQ[r.frequency]}</td>
                    <td className="py-2 text-right text-gray-600">
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
