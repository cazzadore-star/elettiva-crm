import { useState, useMemo, useEffect } from 'react'
import { Plus, Trash2, AlertTriangle, ChevronUp, ChevronsUpDown, ChevronDown, Search, RefreshCw, Download, Users, Package, Tag, X, Archive } from 'lucide-react'
import { useCustomers } from '../hooks/useCustomers'
import { useProducts } from '../hooks/useProducts'
import { useActivePriceForPair } from '../hooks/usePriceLists'
import { useCategories } from '../hooks/useCategories'
import { useRotations } from '../hooks/useRotations'
import { useCreateArchive } from '../hooks/useArchive'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'
import { useForecastPivotAll, useCreateForecastHeader, useUpdateForecastLine, useDeleteForecastHeader, useRecalcForecastFromRotations } from '../hooks/useForecast'

const MONTH_KEYS   = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
const MONTHS_SHORT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']
const CURRENT_YEAR = new Date().getFullYear()
const YEARS        = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 1 + i)

function fmt(n) {
  if (!n && n !== 0) return '—'
  return Number(n).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function fmtEur(n) {
  if (!n && n !== 0) return '—'
  return '€ ' + Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

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

async function exportToExcel(sorted, cols, startYear, endYear) {
  const XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/xlsx.mjs')
  const headers = ['EAN', 'Desc. Forecast', 'Ragione Sociale', 'Listino Medio', ...cols.map(c => c.label), 'Pezzi', 'Valore €']
  const data = sorted.map(row => {
    const rowTotQty = cols.filter(c => c.year === row.year).reduce((s, c) => s + Number(row[c.key] || 0), 0)
    const rowTotRev = rowTotQty * Number(row.avg_price_snapshot || 0)
    return [
      row.ean, row.product_description, row.company_name, Number(row.avg_price_snapshot || 0),
      ...cols.map(c => c.year === row.year ? Number(row[c.key] || 0) : ''),
      rowTotQty, rowTotRev,
    ]
  })
  const totals = [
    '', '', 'TOTALE', '',
    ...cols.map(c => sorted.filter(r => r.year === c.year).reduce((s, r) => s + Number(r[c.key] || 0), 0)),
    sorted.reduce((s, r) => s + cols.filter(c => c.year === r.year).reduce((q, c) => q + Number(r[c.key] || 0), 0), 0),
    sorted.reduce((s, r) => s + cols.filter(c => c.year === r.year).reduce((q, c) => q + Number(r[c.key] || 0), 0) * Number(r.avg_price_snapshot || 0), 0),
  ]
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data, totals])
  ws['!cols'] = [{ wch: 16 }, { wch: 30 }, { wch: 28 }, { wch: 12 }, ...cols.map(() => ({ wch: 10 })), { wch: 12 }, { wch: 14 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Forecast')
  XLSX.writeFile(wb, `forecast_${startYear}_${endYear}.xlsx`)
}

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <ChevronsUpDown size={11} className="inline ml-1" style={{ color: 'var(--text-muted)' }} />
  return sortDir === 'asc'
    ? <ChevronUp size={11} className="inline ml-1" style={{ color: 'var(--brand)' }} />
    : <ChevronDown size={11} className="inline ml-1" style={{ color: 'var(--brand)' }} />
}

function SortableTh({ col, label, sortCol, sortDir, onSort, className }) {
  return (
    <th className={`px-2 py-3 font-medium cursor-pointer select-none transition-colors ${className}`}
      style={{ color: 'var(--text-sub)' }}
      onClick={() => onSort(col)}>
      {label}<SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
    </th>
  )
}

function EditableCell({ value, onSave }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal]         = useState(value ?? 0)

  useEffect(() => {
    if (!editing) setVal(value ?? 0)
  }, [value, editing])

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
    <span onClick={() => setEditing(true)}
      className="cursor-pointer px-1 py-0.5 rounded transition-colors block text-right"
      style={{ color: 'var(--text-main)' }}
      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--brand-50)'; e.currentTarget.style.color = 'var(--brand)' }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-main)' }}
      title="Clicca per modificare">
      {fmt(val)}
    </span>
  )
}

function AddForecastRow({ onClose }) {
  const [year, setYear]             = useState(CURRENT_YEAR)
  const [customerId, setCustomerId] = useState('')
  const [productId, setProductId]   = useState('')
  const [error, setError]           = useState('')

  const { data: customers = [] } = useCustomers()
  const { data: products = [] }  = useProducts()
  const { data: price }          = useActivePriceForPair(customerId, productId)
  const createHeader             = useCreateForecastHeader()

  async function handleSubmit(e) {
    e.preventDefault(); setError('')
    if (!customerId) return setError('Seleziona un cliente.')
    if (!productId)  return setError('Seleziona un prodotto.')
    if (!price)      return setError('Nessun listino attivo per questa combinazione.')
    try {
      await createHeader.mutateAsync({ year, customer_id: Number(customerId), product_id: Number(productId), avg_price_snapshot: price.avg_price })
      onClose()
    } catch (err) { console.error('Errore archiviazione:', err); setError("Errore durante l'archiviazione. Riprova.") }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Anno</label>
        <select className="input" value={year} onChange={e => setYear(Number(e.target.value))}>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Cliente</label>
        <select className="input" value={customerId} onChange={e => { setCustomerId(e.target.value); setProductId('') }}>
          <option value="">— Seleziona cliente —</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Prodotto</label>
        <select className="input" value={productId} onChange={e => setProductId(e.target.value)} disabled={!customerId}>
          <option value="">— Seleziona prodotto —</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.description} — {p.ean}</option>)}
        </select>
      </div>
      {customerId && productId && (
        <div className={`rounded-lg px-3 py-2 text-sm flex items-center gap-2 ${price ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-amber-50 border border-amber-200 text-amber-800'}`}>
          {price ? <>✓ Listino: <strong>€ {Number(price.avg_price).toFixed(4)}</strong></> : <><AlertTriangle size={14} /> Nessun listino attivo.</>}
        </div>
      )}
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Annulla</button>
        <button type="submit" className="btn-primary" disabled={createHeader.isPending}>
          {createHeader.isPending ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Aggiungi riga'}
        </button>
      </div>
    </form>
  )
}

function ArchiveModal({ periodLabel, rowCount, onClose, onSave }) {
  const [name, setName] = useState(`Archivio ${new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}`)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault(); setError('')
    if (!name.trim()) return setError("Inserisci un nome per l'archivio.")
    setSaving(true)
    try { await onSave(name.trim()); onClose() }
    catch (err) { console.error('Errore archiviazione:', err); setError("Errore durante l'archiviazione. Riprova.") }
    finally { setSaving(false) }
  }

  return (
    <Modal title="Archivia Forecast" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--brand-50)', color: 'var(--brand)' }}>
          Periodo: <strong>{periodLabel}</strong><br />
          Righe da archiviare: <strong>{rowCount}</strong> (con i filtri attualmente applicati)
        </div>
        <div>
          <label className="label">Nome archivio</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} autoFocus />
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Usa un nome che ti aiuti a riconoscere il momento della snapshot.</p>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Annulla</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Archive size={14} /> Archivia ora</>}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function sortRows(rows, col, dir) {
  if (!col) return rows
  return [...rows].sort((a, b) => {
    let va = a[col] ?? '', vb = b[col] ?? ''
    if (!isNaN(Number(va)) && !isNaN(Number(vb))) { va = Number(va); vb = Number(vb) }
    else { va = String(va).toLowerCase(); vb = String(vb).toLowerCase() }
    if (va < vb) return dir === 'asc' ? -1 : 1
    if (va > vb) return dir === 'asc' ? 1 : -1
    return 0
  })
}

// Modal generico multi-select con cerca
function MultiSelectModal({ title, icon: Icon, options, selected, onClose, onApply }) {
  const [sel, setSel] = useState(selected)
  const [search, setSearch] = useState('')

  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()))

  function toggle(name) {
    setSel(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name])
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative rounded-xl shadow-xl w-full max-w-md" style={{ backgroundColor: 'var(--bg-card)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold flex items-center gap-2" style={{ color: 'var(--text-main)' }}><Icon size={16} /> {title}</h2>
          <button onClick={onClose} className="p-1 rounded" style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
        </div>
        <div className="px-5 py-4">
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input className="input pl-8" placeholder="Cerca…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2 mb-2">
            <button className="text-xs hover:underline" style={{ color: 'var(--brand)' }} onClick={() => setSel(options)}>Seleziona tutti</button>
            <span style={{ color: 'var(--border)' }}>·</span>
            <button className="text-xs hover:underline" style={{ color: 'var(--text-muted)' }} onClick={() => setSel([])}>Deseleziona tutti</button>
          </div>
          <div className="rounded-lg max-h-72 overflow-y-auto divide-y" style={{ border: `1px solid var(--border)` }}>
            {filtered.map(name => (
              <label key={name} className="flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors"
                style={{ backgroundColor: sel.includes(name) ? 'var(--brand-50)' : 'transparent' }}>
                <input type="checkbox" checked={sel.includes(name)} onChange={() => toggle(name)} className="rounded shrink-0" />
                <span className="text-sm" style={{ color: 'var(--text-main)' }}>{name}</span>
              </label>
            ))}
            {filtered.length === 0 && (
              <p className="text-sm px-3 py-4 text-center" style={{ color: 'var(--text-muted)' }}>Nessun risultato.</p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <button className="btn-secondary" onClick={onClose}>Annulla</button>
          <button className="btn-primary" onClick={() => onApply(sel)}>
            Applica {sel.length > 0 && sel.length < options.length ? `(${sel.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

function FilterButton({ icon: Icon, label, count, total, onClick }) {
  const active = count > 0 && count < total
  return (
    <button className="btn-secondary text-sm" onClick={onClick} style={active ? { borderColor: 'var(--brand)', color: 'var(--brand)' } : {}}>
      <Icon size={14} /> {active ? `${label} (${count})` : `Tutti: ${label.toLowerCase()}`}
    </button>
  )
}

const SEL_STYLE = { width: 'auto' }

export default function ForecastPage() {
  const [startMonth, setStartMonth]         = useState(1)
  const [startYear,  setStartYear]          = useState(CURRENT_YEAR)
  const [endMonth,   setEndMonth]           = useState(12)
  const [endYear,    setEndYear]            = useState(CURRENT_YEAR)
  const [modalOpen, setModalOpen]           = useState(false)
  const [search, setSearch]                 = useState('')
  const [filterCustomers, setFilterCustomers] = useState([]) // vuoto = tutti
  const [filterProducts,  setFilterProducts]  = useState([])
  const [filterCategories, setFilterCategories] = useState([])
  const [filterRotation, setFilterRotation] = useState('')
  const [sortCol, setSortCol]               = useState('')
  const [sortDir, setSortDir]               = useState('asc')
  const [exporting, setExporting]           = useState(false)
  const [openModal, setOpenModal]           = useState(null) // 'customers' | 'products' | 'categories' | null
  const [archiveModalOpen, setArchiveModalOpen] = useState(false)

  const { data: rows = [], isLoading } = useForecastPivotAll()
  const { data: categories = [] }      = useCategories()
  const { data: rotations = [] }       = useRotations()
  const updateLine                     = useUpdateForecastLine()
  const deleteHeader                   = useDeleteForecastHeader()
  const recalc                         = useRecalcForecastFromRotations()
  const createArchive                  = useCreateArchive()

  const cols = useMemo(() => buildMonthRange(startYear, startMonth, endYear, endMonth), [startYear, startMonth, endYear, endMonth])

  const allCustomerNames  = useMemo(() => [...new Set(rows.map(r => r.company_name))].sort(), [rows])
  const allProductNames   = useMemo(() => [...new Set(rows.map(r => r.product_description))].sort(), [rows])
  const allCategoryNames  = useMemo(() => categories.map(c => c.name), [categories])

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const rotationProductIds = useMemo(() => {
    if (!filterRotation) return null
    const rot = rotations.find(r => String(r.id) === filterRotation)
    return rot ? new Set(rot.products.map(p => p.product_id)) : null
  }, [filterRotation, rotations])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return rows.filter(r => {
      if (filterCustomers.length  > 0 && !filterCustomers.includes(r.company_name))         return false
      if (filterProducts.length   > 0 && !filterProducts.includes(r.product_description))   return false
      if (filterCategories.length > 0) {
        const catName = categories.find(c => c.id === r.category_id)?.name
        if (!catName || !filterCategories.includes(catName)) return false
      }
      if (q) {
        const words = q.split(/\s+/).filter(Boolean)
        const text  = [r.company_name, r.product_description, r.ean].join(' ').toLowerCase()
        if (!words.every(w => text.includes(w))) return false
      }
      if (rotationProductIds) {
        const rot = rotations.find(r2 => String(r2.id) === filterRotation)
        if (!rot || r.company_name !== rot.company_name) return false
        if (!rotationProductIds.has(r.product_id)) return false
      }
      return true
    })
  }, [rows, search, filterCustomers, filterProducts, filterCategories, categories, rotationProductIds, rotations, filterRotation])

  const sorted = useMemo(() => sortRows(filtered, sortCol, sortDir), [filtered, sortCol, sortDir])

  async function handleCellSave(row, col, qty) {
    await updateLine.mutateAsync({ headerId: row.header_id, month: col.month, qty_pieces: qty, year: col.year })
  }

  async function handleDelete(row) {
    if (!confirm(`Eliminare il forecast per "${row.company_name} — ${row.product_description}" anno ${row.year}?`)) return
    await deleteHeader.mutateAsync({ id: row.header_id, year: row.year })
  }

  async function handleExport() {
    setExporting(true)
    try { await exportToExcel(sorted, cols, startYear, endYear) }
    finally { setExporting(false) }
  }

 async function handleArchive(name) {
  const periodStart = new Date(startYear, startMonth - 1, 1).toISOString().slice(0, 10)
  const periodEnd   = new Date(endYear, endMonth, 0).toISOString().slice(0, 10)
  console.log('Chiamando createArchive con:', { name, periodStart, periodEnd, startYear, rowsLength: sorted.length })
  const result = await createArchive.mutateAsync({ name, periodStart, periodEnd, startYear, rows: sorted })
  console.log('Risultato createArchive:', result)
}

  const colTotals = useMemo(() => cols.map(c => ({
    ...c,
    total: sorted.filter(r => r.year === c.year).reduce((s, r) => s + Number(r[c.key] || 0), 0)
  })), [sorted, cols])

  const thProps = { sortCol, sortDir, onSort: handleSort }
  const hasFilters = search || filterCustomers.length > 0 || filterProducts.length > 0 || filterCategories.length > 0 || filterRotation

  return (
    <div>
      <PageHeader
        title="Forecast"
        description="Previsioni di vendita per cliente e prodotto"
        action={
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => {
              if (confirm('Ricalcolare il forecast da tutte le rotazioni attive?\nI valori inseriti manualmente nei mesi coperti dalle rotazioni verranno sovrascritti.')) {
                recalc.mutate()
              }
            }} disabled={recalc.isPending}>
              {recalc.isPending ? <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : <><RefreshCw size={15} /> Ricalcola da rotazioni</>}
            </button>
            <button className="btn-secondary" onClick={handleExport} disabled={exporting || sorted.length === 0}>
              {exporting ? <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : <><Download size={15} /> Esporta Excel</>}
            </button>
            <button className="btn-secondary" onClick={() => setArchiveModalOpen(true)}>
              <Archive size={15} /> Archivia
            </button>
            <button className="btn-primary" onClick={() => setModalOpen(true)}><Plus size={16} /> Aggiungi riga</button>
          </div>
        }
      />

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

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input className="input pl-8" style={{ width: '180px' }} placeholder="Cerca…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <FilterButton icon={Users}   label="clienti"   count={filterCustomers.length}  total={allCustomerNames.length} onClick={() => setOpenModal('customers')} />
        <FilterButton icon={Package} label="prodotti"  count={filterProducts.length}   total={allProductNames.length}  onClick={() => setOpenModal('products')} />
        <FilterButton icon={Tag}     label="categorie" count={filterCategories.length} total={allCategoryNames.length} onClick={() => setOpenModal('categories')} />

        <select className="input text-sm" style={{ ...SEL_STYLE, minWidth: '140px' }} value={filterRotation} onChange={e => setFilterRotation(e.target.value)}>
          <option value="">Tutte le rotazioni</option>
          {rotations.map(r => <option key={r.id} value={String(r.id)}>{r.company_name} — {r.product_count} prodotti</option>)}
        </select>

        {hasFilters && (
          <button className="text-sm hover:underline" style={{ color: 'var(--text-muted)' }}
            onClick={() => { setSearch(''); setFilterCustomers([]); setFilterProducts([]); setFilterCategories([]); setFilterRotation('') }}>
            Pulisci
          </button>
        )}
      </div>

      {/* Griglia */}
      <div className="card overflow-x-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-sm" style={{ color: 'var(--text-muted)' }}>Caricamento…</div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-sm gap-2" style={{ color: 'var(--text-muted)' }}>
            <span>Nessuna riga trovata.</span>
            {!hasFilters && <button className="btn-primary mt-2" onClick={() => setModalOpen(true)}><Plus size={15} /> Aggiungi la prima riga</button>}
          </div>
        ) : (
          <table className="w-full text-xs" style={{ minWidth: `${500 + cols.length * 60}px` }}>
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--alt-row)' }}>
                <SortableTh col="ean"                 label="EAN"             {...thProps} className="text-left min-w-28" />
                <SortableTh col="product_description" label="Desc. Forecast"  {...thProps} className="text-left min-w-40" />
                <SortableTh col="company_name"        label="Ragione Sociale" {...thProps} className="text-left min-w-36 sticky left-0" style={{ backgroundColor: 'var(--alt-row)' }} />
                <SortableTh col="avg_price_snapshot"  label="Listino Medio"   {...thProps} className="text-right min-w-20" />
                {cols.map(c => (
                  <th key={`${c.year}-${c.month}`} className="text-right px-2 py-3 font-medium min-w-14" style={{ color: 'var(--text-sub)' }}>{c.label}</th>
                ))}
                <SortableTh col="total_qty"     label="Pezzi"   {...thProps} className="text-right min-w-20 sticky right-16 border-l" />
                <SortableTh col="total_revenue" label="Valore €" {...thProps} className="text-right min-w-24 sticky right-8" />
                <th className="px-3 py-3 min-w-8 sticky right-0" style={{ backgroundColor: 'var(--alt-row)' }} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, idx) => {
                const bg = idx % 2 === 1 ? 'var(--alt-row)' : 'var(--bg-card)'
                const rowTotQty = cols.filter(c => c.year === row.year).reduce((s, c) => s + Number(row[c.key] || 0), 0)
                const rowTotRev = rowTotQty * Number(row.avg_price_snapshot || 0)
                return (
                  <tr key={row.header_id} style={{ backgroundColor: bg, borderBottom: `1px solid var(--border)` }}
                    onMouseEnter={e => Array.from(e.currentTarget.cells).forEach(td => td.style.backgroundColor = 'var(--hover-row)')}
                    onMouseLeave={e => Array.from(e.currentTarget.cells).forEach(td => td.style.backgroundColor = bg)}>
                    <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-muted)', backgroundColor: bg }}>{row.ean}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-sub)', backgroundColor: bg }}>{row.product_description}</td>
                    <td className="px-3 py-2 font-medium sticky left-0" style={{ color: 'var(--text-main)', backgroundColor: bg }}>{row.company_name}</td>
                    <td className="px-3 py-2 text-right" style={{ color: 'var(--text-muted)', backgroundColor: bg }}>{Number(row.avg_price_snapshot || 0).toFixed(2)}</td>
                    {cols.map(c => (
                      <td key={`${c.year}-${c.month}`} className="px-1 py-2" style={{ backgroundColor: bg }}>
                        {c.year === row.year
                          ? <EditableCell value={Number(row[c.key] || 0)} onSave={qty => handleCellSave(row, c, qty)} />
                          : <span className="block text-right" style={{ color: 'var(--text-muted)' }}>—</span>
                        }
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-semibold sticky right-16 border-l" style={{ color: 'var(--text-main)', backgroundColor: bg, borderColor: 'var(--border)' }}>{fmt(rowTotQty)}</td>
                    <td className="px-3 py-2 text-right font-semibold sticky right-8" style={{ color: 'var(--text-main)', backgroundColor: bg }}>{fmtEur(rowTotRev)}</td>
                    <td className="px-3 py-2 sticky right-0" style={{ backgroundColor: bg }}>
                      <button onClick={() => handleDelete(row)} className="p-1 rounded transition-colors" style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.backgroundColor = '#fee2e2' }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent' }}
                        title="Elimina"><Trash2 size={13} /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {sorted.length > 1 && (
              <tfoot>
                <tr className="border-t-2 font-semibold" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--alt-row)' }}>
                  <td className="px-3 py-2" style={{ color: 'var(--text-sub)' }} colSpan={4}>Totale ({sorted.length} righe)</td>
                  {colTotals.map(c => <td key={`${c.year}-${c.month}`} className="px-2 py-2 text-right" style={{ color: 'var(--text-main)' }}>{fmt(c.total)}</td>)}
                  <td className="px-3 py-2 text-right sticky right-16 border-l" style={{ color: 'var(--text-main)', backgroundColor: 'var(--alt-row)', borderColor: 'var(--border)' }}>
                    {fmt(sorted.reduce((s, r) => s + cols.filter(c => c.year === r.year).reduce((q, c) => q + Number(r[c.key] || 0), 0), 0))}
                  </td>
                  <td className="px-3 py-2 text-right sticky right-8" style={{ color: 'var(--text-main)', backgroundColor: 'var(--alt-row)' }}>
                    {fmtEur(sorted.reduce((s, r) => s + cols.filter(c => c.year === r.year).reduce((q, c) => q + Number(r[c.key] || 0), 0) * Number(r.avg_price_snapshot || 0), 0))}
                  </td>
                  <td className="sticky right-0" style={{ backgroundColor: 'var(--alt-row)' }} />
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>

      {sorted.length > 0 && (
        <p className="text-xs mt-2 px-1" style={{ color: 'var(--text-muted)' }}>
          {sorted.length} rig{sorted.length === 1 ? 'a' : 'he'} · Clicca su un numero per modificarlo · Clicca sull'intestazione per ordinare
        </p>
      )}

      {modalOpen && (
        <Modal title="Aggiungi riga forecast" onClose={() => setModalOpen(false)}>
          <AddForecastRow onClose={() => setModalOpen(false)} />
        </Modal>
      )}

      {openModal === 'customers' && (
        <MultiSelectModal title="Filtra per clienti" icon={Users} options={allCustomerNames} selected={filterCustomers}
          onClose={() => setOpenModal(null)}
          onApply={(sel) => { setFilterCustomers(sel.length === allCustomerNames.length ? [] : sel); setOpenModal(null) }} />
      )}
      {openModal === 'products' && (
        <MultiSelectModal title="Filtra per prodotti" icon={Package} options={allProductNames} selected={filterProducts}
          onClose={() => setOpenModal(null)}
          onApply={(sel) => { setFilterProducts(sel.length === allProductNames.length ? [] : sel); setOpenModal(null) }} />
      )}
      {openModal === 'categories' && (
        <MultiSelectModal title="Filtra per categorie" icon={Tag} options={allCategoryNames} selected={filterCategories}
          onClose={() => setOpenModal(null)}
          onApply={(sel) => { setFilterCategories(sel.length === allCategoryNames.length ? [] : sel); setOpenModal(null) }} />
      )}

      {archiveModalOpen && (
        <ArchiveModal
          periodLabel={`${MONTHS_SHORT[startMonth-1]} ${startYear} → ${MONTHS_SHORT[endMonth-1]} ${endYear}`}
          rowCount={sorted.length}
          onClose={() => setArchiveModalOpen(false)}
          onSave={handleArchive}
        />
      )}
    </div>
  )
}
