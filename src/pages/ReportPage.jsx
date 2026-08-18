import React, { useState, useMemo } from 'react'
import { Download, RefreshCw, AlertTriangle, GripVertical, Search } from 'lucide-react'
import { useReportPivot, usePopulateReportFromForecast, useUpsertReportLine } from '../hooks/useReport'
import { useCategories, useUpdateCategoriesOrder } from '../hooks/useCategories'
import PageHeader from '../components/ui/PageHeader'

const CURRENT_YEAR  = new Date().getFullYear()
const YEARS         = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 1 + i)
const MONTH_KEYS    = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
const MONTHS_SHORT  = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']
const MONTHS_IT     = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

function fmt(n) {
  return Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function getReportDesc(row) {
  return row.description_report || row.product_description || '—'
}

function buildMonthRange(startYear, startMonth, endYear, endMonth) {
  const cols = []
  let y = startYear, m = startMonth
  while (y < endYear || (y === endYear && m <= endMonth)) {
    cols.push({ year: y, month: m, key: MONTH_KEYS[m - 1], label: `${MONTHS_SHORT[m - 1]} ${String(y).slice(2)}`, labelIT: MONTHS_IT[m - 1] + ' ' + y })
    m++
    if (m > 12) { m = 1; y++ }
  }
  return cols
}

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
      <input type="number" min="0" step="1" autoFocus value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={() => { setEditing(false); onSave(Number(val) || 0) }}
        onKeyDown={e => {
          if (e.key === 'Enter')  { setEditing(false); onSave(Number(val) || 0) }
          if (e.key === 'Escape') { setEditing(false); setVal(value ?? 0) }
        }}
        className="w-16 text-right text-xs px-1 py-0.5 rounded outline-none"
        style={{ border: `1px solid var(--brand)`, backgroundColor: 'var(--brand-50)', color: 'var(--text-main)' }}
      />
    )
  }
  return (
    <span onClick={() => { setEditing(true); setVal(value ?? 0) }}
      className="cursor-pointer px-1 py-0.5 rounded transition-colors block text-right"
      style={{ color: 'var(--text-main)' }}
      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--brand-50)'; e.currentTarget.style.color = 'var(--brand)' }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-main)' }}
      title="Clicca per modificare">
      {fmt(value)}
    </span>
  )
}

async function exportToExcel(groups, categories, uncategorized, cols, startYear, endYear) {
  const XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/xlsx.mjs')
  const wsData = []
  wsData.push(['Categoria','Desc. Report','SKU', ...cols.map(c => c.labelIT), 'Totale Pezzi'])
  const exportCat = (catName, rows) => {
    if (rows.length === 0) return
    wsData.push([catName, '', '', ...cols.map(() => ''), ''])
    for (const { product_id, rowsByYear } of rows) {
      const vals = cols.map(c => getVal(rowsByYear, product_id, c.year, c.key))
      const qty  = vals.reduce((s, v) => s + v, 0)
      wsData.push(['', getReportDesc(rows.find(r => r.product_id === product_id) || {}), rows.find(r => r.product_id === product_id)?.sku || '', ...vals, qty])
    }
    const subVals = cols.map(c => rows.reduce((s, { product_id, rowsByYear }) => s + getVal(rowsByYear, product_id, c.year, c.key), 0))
    wsData.push([`Totale ${catName}`, '', '', ...subVals, subVals.reduce((s, v) => s + v, 0)])
    wsData.push([])
  }
  for (const cat of categories) exportCat(cat.name, groups[cat.id] || [])
  if (uncategorized.length > 0) exportCat('Senza categoria', uncategorized)
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  ws['!cols'] = [{ wch:28 },{ wch:30 },{ wch:14 },...cols.map(()=>({ wch:12 })),{ wch:12 }]
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
      <div className="relative rounded-xl shadow-xl w-full max-w-sm" style={{ backgroundColor: 'var(--bg-card)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold" style={{ color: 'var(--text-main)' }}>Ordina categorie</h2>
          <button onClick={onClose} className="p-1 rounded" style={{ color: 'var(--text-muted)' }}>✕</button>
        </div>
        <div className="px-5 py-4 space-y-1 max-h-96 overflow-y-auto">
          {order.map((cat, i) => (
            <div key={cat.id} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--alt-row)' }}>
              <GripVertical size={14} style={{ color: 'var(--text-muted)' }} />
              <span className="flex-1 text-sm" style={{ color: 'var(--text-main)' }}>{cat.name}</span>
              <button onClick={() => moveUp(i)}   disabled={i === 0}              className="p-1 disabled:opacity-20" style={{ color: 'var(--text-sub)' }}>▲</button>
              <button onClick={() => moveDown(i)} disabled={i === order.length-1} className="p-1 disabled:opacity-20" style={{ color: 'var(--text-sub)' }}>▼</button>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <button className="btn-secondary" onClick={onClose}>Annulla</button>
          <button className="btn-primary" onClick={() => onSave(order)}>Salva ordine</button>
        </div>
      </div>
    </div>
  )
}

const SEL_STYLE = { width: 'auto' }

export default function ReportPage() {
  const [startMonth, setStartMonth] = useState(1)
  const [startYear,  setStartYear]  = useState(CURRENT_YEAR)
  const [endMonth,   setEndMonth]   = useState(12)
  const [endYear,    setEndYear]    = useState(CURRENT_YEAR)
  const [search, setSearch]                 = useState('')
  const [exporting, setExporting]           = useState(false)
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [showExcluded, setShowExcluded]     = useState(false)

  const { data: rows = [], isLoading } = useReportPivot()
  const { data: categories = [] }      = useCategories()
  const populate       = usePopulateReportFromForecast()
  const upsertLine     = useUpsertReportLine()
  const updateCatOrder = useUpdateCategoriesOrder()

  const cols = useMemo(() => buildMonthRange(startYear, startMonth, endYear, endMonth), [startYear, startMonth, endYear, endMonth])

  // Categorie visibili nel report: escluse le categorie con excluded_from_report,
  // a meno che showExcluded non sia attivo
  const visibleCategories = useMemo(
    () => showExcluded ? categories : categories.filter(c => !c.excluded_from_report),
    [categories, showExcluded]
  )
  const excludedCount = categories.filter(c => c.excluded_from_report).length

  const rowsByYearProduct = useMemo(() => {
    const map = {}
    for (const r of rows) map[`${r.product_id}_${r.year}`] = r
    return map
  }, [rows])

  const uniqueProducts = useMemo(() => {
    const map = {}
    for (const r of rows) {
      if (!map[r.product_id]) map[r.product_id] = {
        product_id: r.product_id, ean: r.ean, sku: r.sku,
        description_report: r.description_report, product_description: r.product_description,
        category_id: r.category_id, avg_price_snapshot: r.avg_price_snapshot,
      }
    }
    return Object.values(map)
  }, [rows])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    let list = uniqueProducts
    if (q) list = list.filter(p => [getReportDesc(p), p.sku, p.ean].some(v => (v||'').toLowerCase().includes(q)))
    return list
  }, [uniqueProducts, search])

  const groups = {}
  const uncategorized = []
  filtered.forEach(p => {
    if (p.category_id) { if (!groups[p.category_id]) groups[p.category_id] = []; groups[p.category_id].push(p) }
    else uncategorized.push(p)
  })

  async function handleCellSave(product_id, col, qty) {
    await upsertLine.mutateAsync({ year: col.year, product_id, month: col.month, qty_pieces: qty, avg_price: rowsByYearProduct[`${product_id}_${col.year}`]?.avg_price_snapshot || 0 })
  }

  async function handlePopulate() {
    if (!confirm('Importa i valori dal Forecast nel Report?\n\nI valori già presenti NON verranno sovrascritti.')) return
    await populate.mutateAsync(CURRENT_YEAR)
  }

  async function handleExport() {
    setExporting(true)
    try {
      const exportGroups = {}
      const exportUncategorized = []
      filtered.forEach(p => {
        const item = { ...p, rowsByYear: rowsByYearProduct }
        if (p.category_id) { if (!exportGroups[p.category_id]) exportGroups[p.category_id] = []; exportGroups[p.category_id].push(item) }
        else exportUncategorized.push(item)
      })
      await exportToExcel(exportGroups, visibleCategories, exportUncategorized, cols, startYear, endYear)
    } finally { setExporting(false) }
  }

  async function handleSaveOrder(ordered) { await updateCatOrder.mutateAsync(ordered); setShowOrderModal(false) }

  const renderRows = (products, startIdx = 0) => products.map((p, i) => {
    const bg = (startIdx + i) % 2 === 1 ? 'var(--alt-row)' : 'var(--bg-card)'
    const rowTotQty = cols.reduce((s, c) => s + getVal(rowsByYearProduct, p.product_id, c.year, c.key), 0)
    return (
      <tr key={p.product_id} style={{ backgroundColor: bg, borderBottom: `1px solid var(--border)` }}
        onMouseEnter={e => Array.from(e.currentTarget.cells).forEach(td => td.style.backgroundColor = 'var(--hover-row)')}
        onMouseLeave={e => Array.from(e.currentTarget.cells).forEach(td => td.style.backgroundColor = bg)}>
        <td className="px-3 py-2" style={{ color: 'var(--text-main)', backgroundColor: bg }}>{getReportDesc(p)}</td>
        <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--text-muted)', backgroundColor: bg }}>{p.sku || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
        {cols.map(c => {
          const val = getVal(rowsByYearProduct, p.product_id, c.year, c.key)
          return (
            <td key={`${c.year}-${c.month}`} className="px-1 py-2" style={{ backgroundColor: bg }}>
              <EditableCell value={val} onSave={qty => handleCellSave(p.product_id, c, qty)} />
            </td>
          )
        })}
        <td className="px-3 py-2 text-right font-semibold sticky right-0 border-l" style={{ color: 'var(--text-main)', backgroundColor: bg, borderColor: 'var(--border)' }}>{fmt(rowTotQty)}</td>
      </tr>
    )
  })

  const renderCategorySubtotal = (products, label) => {
    const subCols = cols.map(c => ({ ...c, total: products.reduce((s, p) => s + getVal(rowsByYearProduct, p.product_id, c.year, c.key), 0) }))
    const subQty = subCols.reduce((s, c) => s + c.total, 0)
    return (
      <tr className="font-semibold text-xs border-b" style={{ backgroundColor: 'var(--brand-50)', borderColor: 'var(--border)' }}>
        <td className="px-3 py-2" colSpan={2} style={{ color: 'var(--brand)' }}>Totale {label}</td>
        {subCols.map(c => <td key={`${c.year}-${c.month}`} className="px-2 py-2 text-right" style={{ color: 'var(--brand)' }}>{fmt(c.total)}</td>)}
        <td className="px-3 py-2 text-right sticky right-0 border-l" style={{ color: 'var(--brand)', backgroundColor: 'var(--brand-50)', borderColor: 'var(--border)' }}>{fmt(subQty)}</td>
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
        <span>Forecast Feb → Report Gen (mesi anticipati di 1). Clicca <strong>Importa da Forecast</strong> per caricare i dati.</span>
      </div>

      {/* Filtri */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <select className="input text-sm" style={{ ...SEL_STYLE, minWidth: '80px' }} value={startMonth} onChange={e => setStartMonth(Number(e.target.value))}>
          {MONTHS_SHORT.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
        </select>
        <select className="input text-sm" style={{ ...SEL_STYLE, minWidth: '70px' }} value={startYear} onChange={e => setStartYear(Number(e.target.value))}>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <span style={{ color: 'var(--text-muted)' }}>→</span>
        <select className="input text-sm" style={{ ...SEL_STYLE, minWidth: '80px' }} value={endMonth} onChange={e => setEndMonth(Number(e.target.value))}>
          {MONTHS_SHORT.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
        </select>
        <select className="input text-sm" style={{ ...SEL_STYLE, minWidth: '70px' }} value={endYear} onChange={e => setEndYear(Number(e.target.value))}>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <div className="relative ml-2">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input className="input pl-8" style={{ width: '200px' }} placeholder="Cerca prodotto, SKU, EAN…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {search && <button className="text-sm hover:underline" style={{ color: 'var(--text-muted)' }} onClick={() => setSearch('')}>Pulisci</button>}

        {excludedCount > 0 && (
          <label className="flex items-center gap-2 text-sm cursor-pointer ml-2" style={{ color: 'var(--text-sub)' }}>
            <input type="checkbox" checked={showExcluded} onChange={e => setShowExcluded(e.target.checked)} className="rounded" />
            Mostra categorie escluse ({excludedCount})
          </label>
        )}

        <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>{cols.length} mes{cols.length === 1 ? 'e' : 'i'}</span>
      </div>

      {isLoading ? (
        <div className="card flex items-center justify-center py-16 text-sm" style={{ color: 'var(--text-muted)' }}>Caricamento…</div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-sm gap-3" style={{ color: 'var(--text-muted)' }}>
          <span>Nessun dato nel report.</span>
          <button className="btn-primary" onClick={handlePopulate} disabled={populate.isPending}>
            <RefreshCw size={14} /> Importa da Forecast
          </button>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-xs" style={{ minWidth: `${400 + cols.length * 60}px` }}>
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--alt-row)' }}>
                <th className="text-left px-3 py-3 font-medium min-w-44" style={{ color: 'var(--text-sub)' }}>Desc. Report</th>
                <th className="text-left px-3 py-3 font-medium min-w-20" style={{ color: 'var(--text-sub)' }}>SKU</th>
                {cols.map(c => <th key={`${c.year}-${c.month}`} className="text-right px-2 py-3 font-medium min-w-14" style={{ color: 'var(--text-sub)' }}>{c.label}</th>)}
                <th className="text-right px-3 py-3 font-medium min-w-20 sticky right-0 border-l" style={{ color: 'var(--text-sub)', backgroundColor: 'var(--alt-row)', borderColor: 'var(--border)' }}>Pezzi</th>
              </tr>
            </thead>
            <tbody>
              {visibleCategories.map(cat => {
                const catProducts = groups[cat.id] || []
                if (catProducts.length === 0) return null
                return (
                  <React.Fragment key={`cat-${cat.id}`}>
                    <tr className="border-b" style={{ backgroundColor: 'var(--alt-row)', borderColor: 'var(--border)' }}>
                      <td colSpan={2 + cols.length + 1} className="px-3 py-2 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--text-sub)' }}>
                        {cat.name}
                        {cat.excluded_from_report && (
                          <span className="ml-2 font-normal text-xs" style={{ color: 'var(--text-muted)' }}>(esclusa dal report)</span>
                        )}
                      </td>
                    </tr>
                    {renderRows(catProducts)}
                    {renderCategorySubtotal(catProducts, cat.name)}
                  </React.Fragment>
                )
              })}
              {uncategorized.length > 0 && (
                <React.Fragment key="cat-none">
                  <tr className="border-b" style={{ backgroundColor: 'var(--alt-row)', borderColor: 'var(--border)' }}>
                    <td colSpan={2 + cols.length + 1} className="px-3 py-2 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--text-sub)' }}>
                      Senza categoria
                    </td>
                  </tr>
                  {renderRows(uncategorized)}
                  {renderCategorySubtotal(uncategorized, 'Senza categoria')}
                </React.Fragment>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showOrderModal && (
        <CategoryOrderModal categories={categories} onClose={() => setShowOrderModal(false)} onSave={handleSaveOrder} />
      )}
    </div>
  )
}
