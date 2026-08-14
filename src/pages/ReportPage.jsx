import React, { useState, useMemo } from 'react'
import { Download, RefreshCw, AlertTriangle, GripVertical, Search } from 'lucide-react'
import { useReportPivot, usePopulateReportFromForecast, useUpsertReportLine } from '../hooks/useReport'
import { useForecastPivot } from '../hooks/useForecast'
import { useCategories, useUpdateCategoriesOrder } from '../hooks/useCategories'
import { useSettings } from '../hooks/useSettings'
import PageHeader from '../components/ui/PageHeader'

const CURRENT_YEAR  = new Date().getFullYear()
const YEARS         = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 1 + i)
const MONTH_KEYS    = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
const MONTHS_SHORT  = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']
const MONTHS_IT     = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

function fmt(n) {
  return Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function fmtEur(n) {
  return Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function getReportDesc(row) {
  return row.description_report || row.product_description || '—'
}

// Genera lista di {year, month, key, label} per un range continuo
function buildMonthRange(startYear, startMonth, endYear, endMonth) {
  const cols = []
  let y = startYear, m = startMonth
  while (y < endYear || (y === endYear && m <= endMonth)) {
    cols.push({
      year:  y,
      month: m,
      key:   MONTH_KEYS[m - 1],
      label: `${MONTHS_SHORT[m - 1]} ${String(y).slice(2)}`,
      labelIT: MONTHS_IT[m - 1] + ' ' + y,
    })
    m++
    if (m > 12) { m = 1; y++ }
  }
  return cols
}

// Valore di un prodotto per un mese/anno specifico
function getVal(rowsByYearProduct, productId, year, monthKey) {
  const key = `${productId}_${year}`
  const row = rowsByYearProduct[key]
  return row ? Number(row[monthKey] || 0) : 0
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

async function exportToExcel(groups, categories, uncategorized, cols, startYear, endYear) {
  const XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/xlsx.mjs')
  const wsData = []
  wsData.push(['Categoria','Desc. Report','SKU', ...cols.map(c => c.labelIT), 'Totale Pezzi', 'Totale Valore'])

  const exportCat = (catName, rows) => {
    if (rows.length === 0) return
    wsData.push([catName, '', '', ...cols.map(() => ''), '', ''])
    for (const { product_id, avgPrice, rowsByYear } of rows) {
      const vals = cols.map(c => getVal(rowsByYear, product_id, c.year, c.key))
      const qty  = vals.reduce((s, v) => s + v, 0)
      const rev  = vals.reduce((s, v, i) => s + v * (avgPrice || 0), 0)
      wsData.push(['', getReportDesc(rows.find(r => r.product_id === product_id) || {}), rows.find(r => r.product_id === product_id)?.sku || '', ...vals, qty, rev])
    }
    // subtotale
    const subVals = cols.map(c => rows.reduce((s, { product_id, rowsByYear }) => s + getVal(rowsByYear, product_id, c.year, c.key), 0))
    const subQty  = subVals.reduce((s, v) => s + v, 0)
    wsData.push([`Totale ${catName}`, '', '', ...subVals, subQty, ''])
    wsData.push([])
  }

  for (const cat of categories) exportCat(cat.name, groups[cat.id] || [])
  if (uncategorized.length > 0) exportCat('Senza categoria', uncategorized)

  const ws = XLSX.utils.aoa_to_sheet(wsData)
  ws['!cols'] = [{ wch:28 },{ wch:30 },{ wch:14 },...cols.map(()=>({ wch:12 })),{ wch:12 },{ wch:14 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, `Report`)
  XLSX.writeFile(wb, `report_${startYear}_${endYear}.xlsx`)
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
              <button onClick={() => moveDown(i)} disabled={i === order.length-1} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20">▼</button>
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
  const { data: settings } = useSettings()

  // Range periodo
  const [startMonth, setStartMonth] = useState(1)
  const [startYear,  setStartYear]  = useState(CURRENT_YEAR)
  const [endMonth,   setEndMonth]   = useState(12)
  const [endYear,    setEndYear]    = useState(CURRENT_YEAR)

  const [search, setSearch]                 = useState('')
  const [exporting, setExporting]           = useState(false)
  const [showOrderModal, setShowOrderModal] = useState(false)

  const { data: rows = [], isLoading } = useReportPivot()
  const { data: forecastRows = [] }    = useForecastPivot(CURRENT_YEAR)
  const { data: categories = [] }      = useCategories()
  const populate        = usePopulateReportFromForecast()
  const upsertLine      = useUpsertReportLine()
  const updateCatOrder  = useUpdateCategoriesOrder()

  // Colonne del range continuo
  const cols = useMemo(
    () => buildMonthRange(startYear, startMonth, endYear, endMonth),
    [startYear, startMonth, endYear, endMonth]
  )

  // Indice rows per (product_id, year) per lookup veloce
  const rowsByYearProduct = useMemo(() => {
    const map = {}
    for (const r of rows) {
      map[`${r.product_id}_${r.year}`] = r
    }
    return map
  }, [rows])

  // Prodotti unici (una riga per product_id) con metadati
  const uniqueProducts = useMemo(() => {
    const map = {}
    for (const r of rows) {
      if (!map[r.product_id]) {
        map[r.product_id] = {
          product_id:          r.product_id,
          ean:                 r.ean,
          sku:                 r.sku,
          description_report:  r.description_report,
          product_description: r.product_description,
          category_id:         r.category_id,
          avg_price_snapshot:  r.avg_price_snapshot,
        }
      }
    }
    return Object.values(map)
  }, [rows])

  // Filtra per ricerca
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return uniqueProducts
    return uniqueProducts.filter(p =>
      [getReportDesc(p), p.sku, p.ean].some(v => (v||'').toLowerCase().includes(q))
    )
  }, [uniqueProducts, search])

  // Raggruppa per categoria
  const groups = {}
  const uncategorized = []
  filtered.forEach(p => {
    if (p.category_id) {
      if (!groups[p.category_id]) groups[p.category_id] = []
      groups[p.category_id].push(p)
    } else {
      uncategorized.push(p)
    }
  })

  async function handleCellSave(product_id, col, qty) {
    await upsertLine.mutateAsync({
      year:       col.year,
      product_id,
      month:      col.month,
      qty_pieces: qty,
      avg_price:  rowsByYearProduct[`${product_id}_${col.year}`]?.avg_price_snapshot || 0,
    })
  }

  async function handlePopulate() {
    if (!confirm(`Importa i valori dal Forecast nel Report?\n\nI valori già presenti NON verranno sovrascritti.`)) return
    await populate.mutateAsync(CURRENT_YEAR)
  }

  async function handleExport() {
    setExporting(true)
    try {
      // Prepara struttura per export
      const exportGroups = {}
      const exportUncategorized = []
      filtered.forEach(p => {
        const item = { ...p, rowsByYear: rowsByYearProduct }
        if (p.category_id) {
          if (!exportGroups[p.category_id]) exportGroups[p.category_id] = []
          exportGroups[p.category_id].push(item)
        } else {
          exportUncategorized.push(item)
        }
      })
      await exportToExcel(exportGroups, categories, exportUncategorized, cols, startYear, endYear)
    } finally {
      setExporting(false)
    }
  }

  async function handleSaveOrder(ordered) {
    await updateCatOrder.mutateAsync(ordered)
    setShowOrderModal(false)
  }

  // Totali generali per colonna
  const grandTotals = useMemo(() => {
    return cols.map(c => ({
      ...c,
      total: filtered.reduce((s, p) => s + getVal(rowsByYearProduct, p.product_id, c.year, c.key), 0)
    }))
  }, [filtered, cols, rowsByYearProduct])

  const renderRows = (products, startIdx = 0) => products.map((p, i) => {
    const bg = (startIdx + i) % 2 === 1 ? '#f3f4f6' : '#ffffff'
    const tdStyle = { backgroundColor: bg }
    const rowTotQty = cols.reduce((s, c) => s + getVal(rowsByYearProduct, p.product_id, c.year, c.key), 0)
    const rowTotRev = cols.reduce((s, c) => s + getVal(rowsByYearProduct, p.product_id, c.year, c.key) * (p.avg_price_snapshot || 0), 0)
    return (
      <tr
        key={p.product_id}
        style={{ backgroundColor: bg }}
        className="border-b border-gray-50 transition-colors"
        onMouseEnter={e => Array.from(e.currentTarget.cells).forEach(td => td.style.backgroundColor = '#eeffee')}
        onMouseLeave={e => Array.from(e.currentTarget.cells).forEach(td => td.style.backgroundColor = bg)}
      >
        <td style={tdStyle} className="px-3 py-2 text-gray-800">{getReportDesc(p)}</td>
        <td style={tdStyle} className="px-3 py-2 font-mono text-gray-500 text-xs">{p.sku || <span className="text-gray-300">—</span>}</td>
        {cols.map(c => {
          const val = getVal(rowsByYearProduct, p.product_id, c.year, c.key)
          return (
            <td key={`${c.year}-${c.month}`} style={tdStyle} className="px-1 py-2">
              <EditableCell value={val} onSave={qty => handleCellSave(p.product_id, c, qty)} />
            </td>
          )
        })}
        <td style={tdStyle} className="px-3 py-2 text-right font-semibold text-gray-900 sticky right-8 border-l border-gray-100">{fmt(rowTotQty)}</td>
        <td style={tdStyle} className="px-3 py-2 text-right font-semibold text-gray-900 sticky right-0">{fmtEur(rowTotRev)}</td>
      </tr>
    )
  })

  const renderCategorySubtotal = (products, label) => {
    const subCols = cols.map(c => ({
      ...c,
      total: products.reduce((s, p) => s + getVal(rowsByYearProduct, p.product_id, c.year, c.key), 0)
    }))
    const subQty = subCols.reduce((s, c) => s + c.total, 0)
    const subRev = products.reduce((s, p) => s + cols.reduce((q, c) => q + getVal(rowsByYearProduct, p.product_id, c.year, c.key) * (p.avg_price_snapshot || 0), 0), 0)
    return (
      <tr className="bg-indigo-50 font-semibold text-xs border-b border-indigo-100">
        <td className="px-3 py-2 text-indigo-700" colSpan={2}>Totale {label}</td>
        {subCols.map(c => <td key={`${c.year}-${c.month}`} className="px-2 py-2 text-right text-indigo-800">{fmt(c.total)}</td>)}
        <td className="px-3 py-2 text-right text-indigo-800 sticky right-8 bg-indigo-50 border-l border-indigo-100">{fmt(subQty)}</td>
        <td className="px-3 py-2 text-right text-indigo-800 sticky right-0 bg-indigo-50">{fmtEur(subRev)}</td>
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
            <button className="btn-secondary" onClick={handlePopulate} disabled={populate.isPending}>
              {populate.isPending
                ? <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                : <><RefreshCw size={14} /> Importa da Forecast</>
              }
            </button>
            <button className="btn-primary" onClick={handleExport} disabled={exporting || filtered.length === 0}>
              {exporting
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <><Download size={14} /> Esporta Excel</>
              }
            </button>
          </div>
        }
      />

      <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-sm text-amber-800">
        <AlertTriangle size={15} className="mt-0.5 shrink-0" />
        <span>Forecast Feb → Report Gen (mesi anticipati di 1). Clicca <strong>Importa da Forecast</strong> per caricare i dati.</span>
      </div>

      {/* Filtri */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {/* Range mese/anno inizio */}
        <select className="input w-28" value={startMonth} onChange={e => setStartMonth(Number(e.target.value))}>
          {MONTHS_SHORT.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
        </select>
        <select className="input w-24" value={startYear} onChange={e => setStartYear(Number(e.target.value))}>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <span className="text-gray-400">→</span>
        <select className="input w-28" value={endMonth} onChange={e => setEndMonth(Number(e.target.value))}>
          {MONTHS_SHORT.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
        </select>
        <select className="input w-24" value={endYear} onChange={e => setEndYear(Number(e.target.value))}>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        {/* Cerca */}
        <div className="relative ml-2">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-8 w-56"
            placeholder="Cerca prodotto, SKU, EAN…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {search && (
          <button className="text-sm text-gray-400 hover:text-gray-600" onClick={() => setSearch('')}>Pulisci</button>
        )}

        {/* Info colonne */}
        <span className="text-xs text-gray-400 ml-auto">{cols.length} mes{cols.length === 1 ? 'e' : 'i'}</span>
      </div>

      {isLoading ? (
        <div className="card flex items-center justify-center py-16 text-gray-400 text-sm">Caricamento…</div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-gray-400 text-sm gap-3">
          <span>Nessun dato nel report.</span>
          <button className="btn-primary" onClick={handlePopulate} disabled={populate.isPending}>
            <RefreshCw size={14} /> Importa da Forecast
          </button>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-xs" style={{ minWidth: `${400 + cols.length * 60}px` }}>
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-3 py-3 font-medium text-gray-500 min-w-44">Desc. Report</th>
                <th className="text-left px-3 py-3 font-medium text-gray-500 min-w-20">SKU</th>
                {cols.map(c => (
                  <th key={`${c.year}-${c.month}`} className="text-right px-2 py-3 font-medium text-gray-500 min-w-14">{c.label}</th>
                ))}
                <th className="text-right px-3 py-3 font-medium text-gray-500 min-w-20 sticky right-8 bg-gray-50 border-l border-gray-100">Pezzi</th>
                <th className="text-right px-3 py-3 font-medium text-gray-500 min-w-24 sticky right-0 bg-gray-50">Valore €</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(cat => {
                const catProducts = groups[cat.id] || []
                if (catProducts.length === 0) return null
                return (
                  <React.Fragment key={`cat-${cat.id}`}>
                    <tr className="bg-gray-100 border-b border-gray-200">
                      <td colSpan={2 + cols.length + 2} className="px-3 py-2 font-semibold text-gray-700 text-xs uppercase tracking-wide">
                        {cat.name}
                      </td>
                    </tr>
                    {renderRows(catProducts)}
                    {renderCategorySubtotal(catProducts, cat.name)}
                  </React.Fragment>
                )
              })}
              {uncategorized.length > 0 && (
                <React.Fragment key="cat-none">
                  <tr className="bg-gray-100 border-b border-gray-200">
                    <td colSpan={2 + cols.length + 2} className="px-3 py-2 font-semibold text-gray-700 text-xs uppercase tracking-wide">
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
                {grandTotals.map(c => <td key={`${c.year}-${c.month}`} className="px-2 py-2 text-right text-gray-900">{fmt(c.total)}</td>)}
                <td className="px-3 py-2 text-right text-gray-900 sticky right-8 bg-gray-100 border-l border-gray-200">
                  {fmt(grandTotals.reduce((s, c) => s + c.total, 0))}
                </td>
                <td className="px-3 py-2 text-right text-gray-900 sticky right-0 bg-gray-100">
                  {fmtEur(filtered.reduce((s, p) => s + cols.reduce((q, c) => q + getVal(rowsByYearProduct, p.product_id, c.year, c.key) * (p.avg_price_snapshot || 0), 0), 0))}
                </td>
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
