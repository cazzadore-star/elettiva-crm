import { useState } from 'react'
import { TrendingUp, Users, Package, Tag } from 'lucide-react'
import { useForecastPivot } from '../hooks/useForecast'
import { useCustomers } from '../hooks/useCustomers'
import { useProducts } from '../hooks/useProducts'
import { usePriceLists } from '../hooks/usePriceLists'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 1 + i)
const MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
const MONTHS = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']

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
  const [year, setYear] = useState(CURRENT_YEAR)

  const { data: rows = [], isLoading } = useForecastPivot(year)
  const { data: customers = [] }       = useCustomers()
  const { data: products = [] }        = useProducts()
  const { data: priceLists = [] }      = usePriceLists()

  const totalQty     = rows.reduce((s, r) => s + Number(r.total_qty     || 0), 0)
  const totalRevenue = rows.reduce((s, r) => s + Number(r.total_revenue || 0), 0)

  const byCustomer = Object.values(
    rows.reduce((acc, r) => {
      if (!acc[r.company_name]) acc[r.company_name] = { name: r.company_name, revenue: 0, qty: 0 }
      acc[r.company_name].revenue += Number(r.total_revenue || 0)
      acc[r.company_name].qty     += Number(r.total_qty     || 0)
      return acc
    }, {})
  ).sort((a, b) => b.revenue - a.revenue).slice(0, 5)

  const byProduct = Object.values(
    rows.reduce((acc, r) => {
      if (!acc[r.product_description]) acc[r.product_description] = { name: r.product_description, revenue: 0, qty: 0 }
      acc[r.product_description].revenue += Number(r.total_revenue || 0)
      acc[r.product_description].qty     += Number(r.total_qty     || 0)
      return acc
    }, {})
  ).sort((a, b) => b.revenue - a.revenue).slice(0, 5)

  const monthly = MONTH_KEYS.map((mk, i) => ({
    label:   MONTHS[i],
    qty:     rows.reduce((s, r) => s + Number(r[mk] || 0), 0),
    revenue: rows.reduce((s, r) => s + Number(r[mk] || 0) * Number(r.avg_price_snapshot || 0), 0),
  }))
  const maxRevenue = Math.max(...monthly.map(m => m.revenue), 1)

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Riepilogo forecast annuale</p>
        </div>
        <select className="input w-28" value={year} onChange={e => setYear(Number(e.target.value))}>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 mb-6 lg:grid-cols-4">
        <KpiCard icon={TrendingUp} label="Fatturato previsto" value={fmtEur(totalRevenue)} sub={`Anno ${year}`} color="bg-brand-600" />
        <KpiCard icon={Package}    label="Pezzi previsti"     value={fmt(totalQty)}         sub={`Anno ${year}`} color="bg-teal-500" />
        <KpiCard icon={Users}      label="Clienti attivi"     value={customers.length}       sub="in anagrafica"  color="bg-indigo-500" />
        <KpiCard icon={Tag}        label="Listini attivi"     value={priceLists.length}      sub="combinazioni"   color="bg-amber-500" />
      </div>

      {/* Grafico mensile */}
      <div className="card p-5 mb-6">
        <h2 className="text-sm font-medium text-gray-700 mb-4">Andamento mensile — fatturato {year}</h2>
        {isLoading ? (
          <div className="h-32 flex items-center justify-center text-gray-400 text-sm">Caricamento…</div>
        ) : (
          <div className="flex items-end gap-1.5 h-32">
            {monthly.map(m => (
              <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-brand-500 rounded-t transition-all"
                  style={{ height: `${Math.max((m.revenue / maxRevenue) * 100, m.revenue > 0 ? 4 : 0)}%`, minHeight: m.revenue > 0 ? '4px' : '0' }}
                  title={fmtEur(m.revenue)}
                />
                <span className="text-xs text-gray-400">{m.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top clienti + Top prodotti */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Top clienti per fatturato</h2>
          {byCustomer.length === 0 ? (
            <p className="text-sm text-gray-400">Nessun dato per il {year}.</p>
          ) : (
            <div className="space-y-2">
              {byCustomer.map((c, i) => (
                <div key={c.name} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-gray-400 w-4">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-900 truncate">{c.name}</span>
                      <span className="text-sm font-medium text-gray-900 ml-2">{fmtEur(c.revenue)}</span>
                    </div>
                    <div className="h-1 bg-gray-100 rounded mt-1">
                      <div className="h-1 bg-brand-400 rounded" style={{ width: `${(c.revenue / (byCustomer[0]?.revenue || 1)) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Top prodotti per fatturato</h2>
          {byProduct.length === 0 ? (
            <p className="text-sm text-gray-400">Nessun dato per il {year}.</p>
          ) : (
            <div className="space-y-2">
              {byProduct.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-gray-400 w-4">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-900 truncate">{p.name}</span>
                      <span className="text-sm font-medium text-gray-900 ml-2">{fmtEur(p.revenue)}</span>
                    </div>
                    <div className="h-1 bg-gray-100 rounded mt-1">
                      <div className="h-1 bg-teal-400 rounded" style={{ width: `${(p.revenue / (byProduct[0]?.revenue || 1)) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
