import React, { useState, useMemo } from 'react'
import { Download, RefreshCw, AlertTriangle, GripVertical, Search } from 'lucide-react'
import { useReportPivot, usePopulateReportFromForecast, useUpsertReportLine } from '../hooks/useReport'
import { useForecastPivot } from '../hooks/useForecast'
import { useCategories, useUpdateCategoriesOrder } from '../hooks/useCategories'
import PageHeader from '../components/ui/PageHeader'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS        = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 1 + i)
const MONTH_KEYS   = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
const MONTHS_SHORT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']
const MONTHS_IT    = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

function fmt(n) {
  return Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function fmtEur(n) {
  return Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function getReportDesc(row) {
  return row.description_report || row.product_description || '—'
}

function EditableCell({ value, onSave }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal]         = useState(value ?? 0)

  if (editing) {
    return (
      <input
        type="number" min="0" step="1" autoFocus
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={() => { setEditing(false); onSave(Number(val) || 0) }}
        onKeyDown={e => {
          if (e.key === 'Enter')  { setEditing(false); onSave(Number(val) || 0) }
          if (e.key === 'Escape') { setEditing(false); setVal(value ?? 0) }
        }}
        className="w-16 text-right text-xs px-1 py-0.5 border border-brand-400 rounded outline-none bg-brand-50"
      />
    )
  }
  return (
    <span
      onClick={() => { setEditing(true); setVal(value ?? 0) }}
      className="cursor-pointer hover:bg-brand-50 hover:text-brand-700 px-1 py-0.5 rounded transition-colors block text-right"
      title="Clicca per modificare"
    >
      {fmt(value)}
    </span>
  )
}

async function exportToExcel(groups, categories, uncategorized, year) {
  const XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/xlsx.mjs')
  const wsData = []
  wsData.push(['Categoria','Desc. Report','SKU',...MONTHS_IT,'Totale Pezzi','Totale Valore'])

  const exportCat = (catName, rows) => {
    if (rows.length === 0) return
    wsData.push([catName, '', '', ...Array(12).fill(''), '', ''])
    for (const r of rows) {
      wsData.push(['', getReportDesc(r), r.sku || '', ...MONTH_KEYS.map(mk => Number(r[mk] || 0)), Number(r.total_qty || 0), Number(r.total_revenue || 0)])
    }
    wsData.push([`Totale ${catName}`, '', '',
      ...MONTH_KEYS.map(mk => rows.reduce((s, r) => s + Number(r[mk] || 0), 0)),
      rows.reduce((s, r) => s + Number(r.total_qty || 0), 0),
      rows.reduce((s, r) => s + Number(r.total_revenue || 0), 0),
    ])
    wsData.push([])
  }

  for (const cat of categories) exportCat(cat.name, groups[cat.id] || [])
  if (uncategorized.length > 0) exportCat('Senza categoria', uncategorized)

  const ws = XLSX.utils.aoa_to_sheet(wsData)
  ws['!cols'] = [{ wch:28 },{ wch:30 },{ wch:14 },...MONTHS_IT.map(()=>({ wch:10 })),{ wch:12 },{ wch:14 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, `Report ${year}`)
  XLSX.writeFile(wb, `report_${year}.xlsx`)
}

function CategoryOrderModal({ categories, onClose, onSave }) {
  const [order, setOrder] = useState([...categories])
  function moveUp(i)   { if (i === 0) return; const n = [...order]; [n[i-1], n[i]] = [n[i], n[i-1]]; setOrder(n) }
  function moveDown(i) { if (i === order.length-1) return; const n = [...order]; [n[i], n[i+1]] = [n[i+1], n[i]]; setOrder(n) }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Ordina categorie</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="px-5 py-4 space-y-1 max-h-96 overflow-y-auto">
          {order.map((cat, i) => (
            <div key={cat.id} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
              <GripVertical size={14} className="text-gray-300" />
              <span className="flex-1 text-sm text-gray-800">{cat.name}</span>
              <button onClick={() => moveUp(i)}   disabled={i === 0}              className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20">▲</button>
              <button onClick={() => moveDown(i)} disabled={i === order.length-1} className="p1 text-gray-400 hover:text-gray-700 disabled:opacity-20">▼</button>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button className="btn-secondary" onClick={onClose}>Annulla</button>
          <button className="btn-primary" onClick={() => onSave(order)}>Salva ordine</button>
        </div>
      </div>
    </div>
  )
}

export default function ReportPage() {
  const [year, setYear]                     = useState(CURRENT_YEAR)
  const [search, setSearch]                 = useState('')
  const [exporting, setExporting]           = useState(false)
  const [showOrderModal, setShowOrderModal] = useState(false)

  const { data: rows = [], isLoading } = useReportPivot(year)
  const { data: forecastRows = [] }    = useForecastPivot(year)
  const { data: categories = [] }      = useCategories()
  const populate        = usePopulateReportFromForecast()
  const upsertLine      = useUpsertReportLine()
  const updateCatOrder  = useUpdateCategoriesOrder()

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return rows
    return rows.filter(r =>
      [getReportDesc(r), r.sku, r.ean, r.company_name].some(v => (v||'').toLowerCase().includes(q))
    )
  }, [rows, search])

  const groups = {}
  const uncategorized = []
  filtered.forEach(r => {
    if (r.category_id) {
      if (!groups[r.category_id]) groups[r.category_id] = []
      groups[r.category_id].push(r)
    } else {
      uncategorized.push(r)
    }
  })

  async function handleCellSave(row, monthIndex, qty) {
    await upsertLine.mutateAsync({
      year,
      product_id: row.product_id,
      month:      monthIndex + 1,
      qty_pieces: qty,
      avg_price:  row.avg_price_snapshot,
    })
  }

  async function handlePopulate() {
    if (!confirm(`Importa i valori dal Forecast ${year} nel Report ${year}?\n\nI valori già presenti NON verranno sovrascritti.`)) return
    await populate.mutateAsync(year)
  }

  async function handleExport() {
    setExporting(true)
    try { await exportToExcel(groups, categories, uncategorized, year) }
    finally { setExporting(false) }
  }

  async function handleSaveOrder(ordered) {
    await updateCatOrder.mutateAsync(ordered)
    setShowOrderModal(false)
  }

  const grandTotals = filtered.reduce((acc, r) => {
    MONTH_KEYS.forEach(mk => { acc[mk] = (acc[mk] || 0) + Number(r[mk] || 0) })
    acc.total_qty     = (acc.total_qty     || 0) + Number(r.total_qty     || 0)
    acc.total_revenue = (acc.total_revenue || 0) + Number(r.total_revenue || 0)
    return acc
  }, {})

  const renderRows = (rowList, startIdx = 0) => rowList.map((row, i) => {
    const bg = (startIdx + i) % 2 === 1 ? '#f3f4f6' : '#ffffff'
    const tdStyle = { backgroundColor: bg }
    return (
      <tr
        key={`${row.customer_id}-${row.product_id}`}
        style={{ backgroundColor: bg }}
        className="border-b border-gray-50 transition-colors"
        onMouseEnter={e => { Array.from(e.currentTarget.cells).forEach(td => td.style.backgroundColor = '#eeffee') }}
        onMouseLeave={e => { Array.from(e.currentTarget.cells).forEach(td => td.style.backgroundColor = bg) }}
      >
        <td style={tdStyle} className="px-3 py-2 text-gray-800">{getReportDesc(row)}</td>
        <td style={tdStyle} className="px-3 py-2 font-mono text-gray-500 text-xs">{row.sku || <span className="text-gray-300">—</span>}</td>
        {MONTH_KEYS.map((mk, mi) => (
          <td key={mk} style={tdStyle} className="px-1 py-2">
            <EditableCell value={row[mk]} onSave={qty => handleCellSave(row, mi, qty)} />
          </td>
        ))}
        <td style={tdStyle} className="px-3 py-2 text-right font-semibold text-gray-900 sticky right-8 border-l border-gray-100">{fmt(row.total_qty)}</td>
        <td style={tdStyle} className="px-3 py-2 text-right font-semibold text-gray-900 sticky right-0">{fmtEur(row.total_revenue)}</td>
      </tr>
    )
  })

  const renderCategorySubtotal = (rowList, label) => {
    const sub = rowList.reduce((acc, r) => {
      MONTH_KEYS.forEach(mk => { acc[mk] = (acc[mk] || 0) + Number(r[mk] || 0) })
      acc.total_qty     = (acc.total_qty     || 0) + Number(r.total_qty     || 0)
      acc.total_revenue = (acc.total_revenue || 0) + Number(r.total_revenue || 0)
      return acc
    }, {})
    return (
      <tr className="bg-indigo-50 font-semibold text-xs border-b border-indigo-100">
        <td className="px-3 py-2 text-indigo-700" colSpan={2}>Totale {label}</td>
        {MONTH_KEYS.map(mk => <td key={mk} className="px-2 py-2 text-right text-indigo-800">{fmt(sub[mk])}</td>)}
        <td className="px-3 py-2 text-right text-indigo-800 sticky right-8 bg-indigo-50 border-l border-indigo-100">{fmt(sub.total_qty)}</td>
        <td className="px-3 py-2 text-right text-indigo-800 sticky right-0 bg-indigo-50">{fmtEur(sub.total_revenue)}</td>
      </tr>
    )
  }

  return (
    <div>
      <PageHeader
        title="Report"
        description="Valori per categoria — mesi anticipati di 1 rispetto al Forecast"
        action={
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => setShowOrderModal(true)}>Ordina categorie</button>
            <button className="btn-secondary" onClick={handlePopulate} disabled={populate.isPending || forecastRows.length === 0}>
              {populate.isPending ? <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : <><RefreshCw size={14} /> Importa da Forecast</>}
            </button>
            <button className="btn-primary" onClick={handleExport} disabled={exporting || filtered.length === 0}>
              {exporting ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Download size={14} /> Esporta Excel</>}
            </button>
          </div>
        }
      />

      <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-sm text-amber-800">
        <AlertTriangle size={15} className="mt-0.5 shrink-0" />
        <span>Forecast Feb → Report Gen (mesi anticipati di 1). Clicca <strong>Importa da Forecast</strong> per caricare i dati, poi modifica liberamente le celle.</span>
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select className="input w-28" value={year} onChange={e => setYear(Number(e.target.value))}>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-8 w-64"
            placeholder="Cerca per prodotto, SKU, EAN…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {search && (
          <button className="text-sm text-gray-400 hover:text-gray-600" onClick={() => setSearch('')}>Pulisci</button>
        )}
      </div>

      {isLoading ? (
        <div className="card flex items-center justify-center py-16 text-gray-400 text-sm">Caricamento…</div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-gray-400 text-sm gap-3">
          <span>Nessun dato nel report per il {year}.</span>
          {forecastRows.length > 0 && !search && (
            <button className="btn-primary" onClick={handlePopulate} disabled={populate.isPending}>
              <RefreshCw size={14} /> Importa da Forecast {year}
            </button>
          )}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-xs" style={{ minWidth: '1100px' }}>
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-3 py-3 font-medium text-gray-500 min-w-44">Desc. Report</th>
                <th className="text-left px-3 py-3 font-medium text-gray-500 min-w-20">SKU</th>
                {MONTHS_SHORT.map(m => <th key={m} className="text-right px-2 py-3 font-medium text-gray-500 min-w-14">{m}</th>)}
                <th className="text-right px-3 py-3 font-medium text-gray-500 min-w-20 sticky right-8 bg-gray-50 border-l border-gray-100">Pezzi</th>
                <th className="text-right px-3 py-3 font-medium text-gray-500 min-w-24 sticky right-0 bg-gray-50">Valore €</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(cat => {
                const catRows = groups[cat.id] || []
                if (catRows.length === 0) return null
                return (
                  <React.Fragment key={`cat-${cat.id}`}>
                    <tr className="bg-gray-100 border-b border-gray-200">
                      <td colSpan={2 + 12 + 2} className="px-3 py-2 font-semibold text-gray-700 text-xs uppercase tracking-wide">
                        {cat.name}
                      </td>
                    </tr>
                    {renderRows(catRows)}
                    {renderCategorySubtotal(catRows, cat.name)}
                  </React.Fragment>
                )
              })}
              {uncategorized.length > 0 && (
                <React.Fragment key="cat-none">
                  <tr className="bg-gray-100 border-b border-gray-200">
                    <td colSpan={2 + 12 + 2} className="px-3 py-2 font-semibold text-gray-700 text-xs uppercase tracking-wide">
                      Senza categoria
                    </td>
                  </tr>
                  {renderRows(uncategorized)}
                  {renderCategorySubtotal(uncategorized, 'Senza categoria')}
                </React.Fragment>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 bg-gray-100 font-semibold text-xs">
                <td className="px-3 py-2 text-gray-800" colSpan={2}>Totale generale</td>
                {MONTH_KEYS.map(mk => <td key={mk} className="px-2 py-2 text-right text-gray-900">{fmt(grandTotals[mk])}</td>)}
                <td className="px-3 py-2 text-right text-gray-900 sticky right-8 bg-gray-100 border-l border-gray-200">{fmt(grandTotals.total_qty)}</td>
                <td className="px-3 py-2 text-right text-gray-900 sticky right-0 bg-gray-100">{fmtEur(grandTotals.total_revenue)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {showOrderModal && (
        <CategoryOrderModal
          categories={categories}
          onClose={() => setShowOrderModal(false)}
          onSave={handleSaveOrder}
        />
      )}
    </div>
  )
}
