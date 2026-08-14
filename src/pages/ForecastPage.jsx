import { useState, useMemo } from 'react'
import { Plus, Trash2, AlertTriangle, ChevronDown, ChevronUp, ChevronsUpDown, Search } from 'lucide-react'
import { useForecastPivot, useCreateForecastHeader, useUpdateForecastLine, useDeleteForecastHeader } from '../hooks/useForecast'
import { useCustomers } from '../hooks/useCustomers'
import { useProducts } from '../hooks/useProducts'
import { useActivePriceForPair } from '../hooks/usePriceLists'
import { useCategories } from '../hooks/useCategories'
import { useRotations } from '../hooks/useRotations'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'

const MONTHS = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']
const MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 1 + i) 

function fmt(n) {
  if (!n && n !== 0) return '—'
  return Number(n).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function fmtEur(n) {
  if (!n && n !== 0) return '—'
  return '€ ' + Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <ChevronsUpDown size={11} className="inline ml-1 text-gray-300" />
  return sortDir === 'asc'
    ? <ChevronUp size={11} className="inline ml-1 text-brand-600" />
    : <ChevronDown size={11} className="inline ml-1 text-brand-600" />
}

function SortableTh({ col, label, sortCol, sortDir, onSort, className }) {
  return (
    <th
      className={`px-2 py-3 font-medium text-gray-500 cursor-pointer select-none hover:text-gray-800 hover:bg-gray-100 transition-colors ${className}`}
      onClick={() => onSort(col)}
    >
      {label}<SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
    </th>
  )
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
      onClick={() => setEditing(true)}
      className="cursor-pointer hover:bg-brand-50 hover:text-brand-700 px-1 py-0.5 rounded transition-colors block text-right"
      title="Clicca per modificare"
    >
      {fmt(val)}
    </span>
  )
}

function AddForecastRow({ year, onClose }) {
  const [customerId, setCustomerId] = useState('')
  const [productId, setProductId]   = useState('')
  const [error, setError]           = useState('')
  const { data: customers = [] } = useCustomers()
  const { data: products = [] }  = useProducts()
  const { data: price }          = useActivePriceForPair(customerId, productId)
  const createHeader             = useCreateForecastHeader()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!customerId) return setError('Seleziona un cliente.')
    if (!productId)  return setError('Seleziona un prodotto.')
    if (!price)      return setError('Nessun listino attivo per questa combinazione. Vai su Listini medi e aggiungilo prima.')
    try {
      await createHeader.mutateAsync({
        year,
        customer_id:        Number(customerId),
        product_id:         Number(productId),
        avg_price_snapshot: price.avg_price,
      })
      onClose()
    } catch (err) {
      if (err.message?.includes('forecast_headers_unique')) {
        setError('Esiste già una riga forecast per questa combinazione in questo anno.')
      } else {
        setError('Errore nel salvataggio. Riprova.')
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
          {price ? <>✓ Listino trovato: <strong>€ {Number(price.avg_price).toFixed(4)}</strong></> : <><AlertTriangle size={14} /> Nessun listino attivo.</>}
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

export default function ForecastPage() {
  const [year, setYear]                     = useState(CURRENT_YEAR)
  const [modalOpen, setModalOpen]           = useState(false)
  const [search, setSearch]                 = useState('')
  const [filterCustomer, setFilterCustomer] = useState('')
  const [filterProduct, setFilterProduct]   = useState('')
  const [sortCol, setSortCol]               = useState('')
  const [sortDir, setSortDir]               = useState('asc')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterRotation, setFilterRotation] = useState('')

  const { data: rows = [], isLoading } = useForecastPivot(year)
  const { data: categories = [] }      = useCategories()
  const { data: rotations = [] }       = useRotations()
  const updateLine                     = useUpdateForecastLine()
  const deleteHeader                   = useDeleteForecastHeader()

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  // Costruisce set di product_id dalla rotazione selezionata
  const rotationProductIds = useMemo(() => {
    if (!filterRotation) return null
    const rot = rotations.find(r => String(r.id) === filterRotation)
    if (!rot) return null
    return new Set(rot.products.map(p => p.product_id))
  }, [filterRotation, rotations])

  // Mappa product_id -> category_id dalla forecast_pivot
  // La pivot ha product_id, lo usiamo per filtrare per categoria
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return rows.filter(r => {
      if (filterCustomer && r.company_name        !== filterCustomer) return false
      if (filterProduct  && r.product_description !== filterProduct)  return false
      if (q) {
  const words = q.split(/\s+/).filter(Boolean)
  const text = [r.company_name, r.product_description, r.ean].join(' ').toLowerCase()
  if (!words.every(w => text.includes(w))) return false
}
      // Filtro categoria: confronta con category_id del prodotto
      if (filterCategory && String(r.category_id) !== filterCategory) return false
      // Filtro rotazione: mostra solo cliente+prodotti della rotazione
      if (rotationProductIds) {
        const rot = rotations.find(r2 => String(r2.id) === filterRotation)
        if (!rot) return false
        if (r.company_name !== rot.company_name) return false
        if (!rotationProductIds.has(r.product_id)) return false
      }
      return true
    })
  }, [rows, search, filterCustomer, filterProduct, filterCategory, rotationProductIds])

  const sorted = useMemo(() => sortRows(filtered, sortCol, sortDir), [filtered, sortCol, sortDir])

  async function handleCellSave(headerId, month, qty) {
    await updateLine.mutateAsync({ headerId, month, qty_pieces: qty, year })
  }

  async function handleDelete(row) {
    if (!confirm(`Eliminare il forecast per "${row.company_name} — ${row.product_description}" per l'anno ${year}?`)) return
    await deleteHeader.mutateAsync({ id: row.header_id, year })
  }

  const totals = sorted.reduce((acc, r) => {
    MONTH_KEYS.forEach(mk => { acc[mk] = (acc[mk] || 0) + Number(r[mk] || 0) })
    acc.total_qty     = (acc.total_qty     || 0) + Number(r.total_qty     || 0)
    acc.total_revenue = (acc.total_revenue || 0) + Number(r.total_revenue || 0)
    return acc
  }, {})

  const thProps = { sortCol, sortDir, onSort: handleSort }

  return (
    <div>
      <PageHeader
        title="Forecast"
        description="Previsioni di vendita per cliente e prodotto"
        action={
          <button className="btn-primary" onClick={() => setModalOpen(true)}>
            <Plus size={16} /> Aggiungi riga
          </button>
        }
      />

      {/* Filtri */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
         <div className="relative">
          <select className="input pr-8 appearance-none font-medium" value={year} onChange={e => setYear(Number(e.target.value))}>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div> 

        {/* Cerca generico */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-8 w-56"
            placeholder="Cerca EAN, prodotto, cliente…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select className="input max-w-44" value={filterCustomer} onChange={e => setFilterCustomer(e.target.value)}>
          <option value="">Tutti i clienti</option>
          {[...new Set(rows.map(r => r.company_name))].sort().map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select className="input max-w-44" value={filterProduct} onChange={e => setFilterProduct(e.target.value)}>
          <option value="">Tutti i prodotti</option>
          {[...new Set(rows.map(r => r.product_description))].sort().map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select className="input max-w-44" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          <option value="">Tutte le categorie</option>
          {categories.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
        </select>
        <select className="input max-w-44" value={filterRotation} onChange={e => { setFilterRotation(e.target.value); setFilterCustomer(''); setFilterProduct('') }}>
          <option value="">Tutte le rotazioni</option>
          {rotations.map(r => (
            <option key={r.id} value={String(r.id)}>
              {r.company_name} — {new Date(r.period_start).toLocaleDateString('it-IT', { month: 'short', year: '2-digit' })} / {r.product_count} prodotti
            </option>
          ))}
        </select>

        {(search || filterCustomer || filterProduct || filterCategory || filterRotation) && (
          <button className="text-sm text-gray-400 hover:text-gray-600" onClick={() => { setSearch(''); setFilterCustomer(''); setFilterProduct(''); setFilterCategory(''); setFilterRotation('') }}>
            Pulisci filtri
          </button>
        )}
        {sortCol && (
          <button className="text-sm text-gray-400 hover:text-gray-600" onClick={() => { setSortCol(''); setSortDir('asc') }}>
            Rimuovi ordinamento
          </button>
        )}
      </div>

      {/* Griglia */}
      <div className="card overflow-x-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Caricamento…</div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 text-sm gap-2">
            <span>Nessuna riga trovata.</span>
            {!search && !filterCustomer && !filterProduct && (
              <button className="btn-primary mt-2" onClick={() => setModalOpen(true)}>
                <Plus size={15} /> Aggiungi la prima riga
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-xs" style={{ minWidth: '1200px' }}>
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <SortableTh col="ean"                 label="EAN"             {...thProps} className="text-left min-w-32" />
                <SortableTh col="product_description" label="Desc. Forecast"  {...thProps} className="text-left min-w-44" />
                <SortableTh col="company_name"        label="Ragione Sociale" {...thProps} className="text-left min-w-36 sticky left-0 bg-gray-50" />
                <SortableTh col="avg_price_snapshot"  label="Listino Medio"   {...thProps} className="text-right min-w-24" />
                {MONTHS.map((m, i) => (
                  <SortableTh key={m} col={MONTH_KEYS[i]} label={m} {...thProps} className="text-right min-w-14" />
                ))}
                <SortableTh col="total_qty"     label="Pezzi"    {...thProps} className="text-right min-w-20 sticky right-16 bg-gray-50 border-l border-gray-100" />
                <SortableTh col="total_revenue" label="Valore €"  {...thProps} className="text-right min-w-24 sticky right-8 bg-gray-50" />
                <th className="px-3 py-3 min-w-8 sticky right-0 bg-gray-50" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, idx) => {
                const bg = idx % 2 === 1 ? '#f3f4f6' : '#ffffff'
                const tdStyle = { backgroundColor: bg }
                return (
                  <tr
                    key={row.header_id}
                    style={{ backgroundColor: bg }}
                    className="border-b border-gray-50 transition-colors"
                    onMouseEnter={e => { Array.from(e.currentTarget.cells).forEach(td => td.style.backgroundColor = '#eeffee') }}
                    onMouseLeave={e => { Array.from(e.currentTarget.cells).forEach(td => td.style.backgroundColor = bg) }}
                  >
                    <td style={tdStyle} className="px-3 py-2 font-mono text-gray-500">{row.ean}</td>
                    <td style={tdStyle} className="px-3 py-2 text-gray-700">{row.product_description}</td>
                    <td style={tdStyle} className="px-3 py-2 font-medium text-gray-900 sticky left-0">{row.company_name}</td>
                    <td style={tdStyle} className="px-3 py-2 text-right text-gray-500">{Number(row.avg_price_snapshot).toFixed(2)}</td>
                    {MONTH_KEYS.map((mk, i) => (
                      <td key={mk} style={tdStyle} className="px-1 py-2">
                        <EditableCell value={row[mk]} onSave={qty => handleCellSave(row.header_id, i + 1, qty)} />
                      </td>
                    ))}
                    <td style={tdStyle} className="px-3 py-2 text-right font-semibold text-gray-900 sticky right-16 border-l border-gray-100">{fmt(row.total_qty)}</td>
                    <td style={tdStyle} className="px-3 py-2 text-right font-semibold text-gray-900 sticky right-8">{fmtEur(row.total_revenue)}</td>
                    <td style={tdStyle} className="px-3 py-2 sticky right-0">
                      <button onClick={() => handleDelete(row)} className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors" title="Elimina">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {sorted.length > 1 && (
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-100 font-semibold">
                  <td className="px-3 py-2 text-gray-700" colSpan={4}>Totale ({sorted.length} righe)</td>
                  {MONTH_KEYS.map(mk => <td key={mk} className="px-2 py-2 text-right text-gray-900">{fmt(totals[mk])}</td>)}
                  <td className="px-3 py-2 text-right text-gray-900 sticky right-16 bg-gray-100 border-l border-gray-200">{fmt(totals.total_qty)}</td>
                  <td className="px-3 py-2 text-right text-gray-900 sticky right-8 bg-gray-100">{fmtEur(totals.total_revenue)}</td>
                  <td className="sticky right-0 bg-gray-100" />
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>

      {sorted.length > 0 && (
        <p className="text-xs text-gray-400 mt-2 px-1">
          {sorted.length} rig{sorted.length === 1 ? 'a' : 'he'} · Clicca su un numero per modificarlo · Clicca sull'intestazione per ordinare
        </p>
      )}

      {modalOpen && (
        <Modal title={`Aggiungi riga forecast ${year}`} onClose={() => setModalOpen(false)}>
          <AddForecastRow year={year} onClose={() => setModalOpen(false)} />
        </Modal>
      )}
    </div>
  )
}
