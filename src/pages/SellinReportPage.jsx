import React, { useState, useMemo } from 'react'
import { Users, Search, X, Upload, Download } from 'lucide-react'
import { useSellinYears, useSellinPivotYearly } from '../hooks/useSellin'
import { useActiveBrand } from '../hooks/useActiveBrand'
import PageHeader from '../components/ui/PageHeader'
import { useNavigate } from 'react-router-dom'

const MONTHS_SHORT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']
const MONTH_KEYS   = ['m1','m2','m3','m4','m5','m6','m7','m8','m9','m10','m11','m12']

function fmt(n) {
  if (n === null || n === undefined) return '—'
  return Number(n).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function fmtRot(n) {
  if (n === null || n === undefined) return '—'
  return Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Modal multi-select clienti (stesso pattern usato nel Report Previsionale)
function CustomerFilterModal({ allCustomers, selected, onClose, onApply }) {
  const [sel, setSel] = useState(selected)
  const [search, setSearch] = useState('')
  const filtered = allCustomers.filter(c => c.toLowerCase().includes(search.toLowerCase()))
  function toggle(name) { setSel(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]) }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative rounded-xl shadow-xl w-full max-w-md" style={{ backgroundColor: 'var(--bg-card)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold" style={{ color: 'var(--text-main)' }}>Filtra per clienti</h2>
          <button onClick={onClose} className="p-1 rounded" style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
        </div>
        <div className="px-5 py-4">
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input className="input pl-8" placeholder="Cerca cliente…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2 mb-2">
            <button className="text-xs hover:underline" style={{ color: 'var(--brand)' }} onClick={() => setSel(allCustomers)}>Seleziona tutti</button>
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
            {filtered.length === 0 && <p className="text-sm px-3 py-4 text-center" style={{ color: 'var(--text-muted)' }}>Nessun cliente trovato.</p>}
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <button className="btn-secondary" onClick={onClose}>Annulla</button>
          <button className="btn-primary" onClick={() => onApply(sel)}>Applica {sel.length > 0 ? `(${sel.length})` : ''}</button>
        </div>
      </div>
    </div>
  )
}

async function exportToExcel(products, customerGroups, cols, year) {
  const XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/xlsx.mjs')
  const header1 = ['', '']
  const header2 = ['EAN', 'Descrizione']
  for (const g of customerGroups) {
    for (let i = 0; i < cols.length; i++) header1.push(i === 0 ? g.name : '')
    header1.push('')
    for (const c of cols) header2.push(c.label)
    header2.push('ROTAZ')
  }
  const data = products.map(p => {
    const row = [p.ean, p.description]
    for (const g of customerGroups) {
      const rec = g.byProduct[p.product_id]
      for (const c of cols) row.push(rec ? rec[c.key] : '')
      row.push(rec ? rec.rotation_avg : '')
    }
    return row
  })
  const ws = XLSX.utils.aoa_to_sheet([header1, header2, ...data])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, `Sell-in ${year}`)
  XLSX.writeFile(wb, `sellin_${year}.xlsx`)
}

export default function SellinReportPage() {
  const navigate = useNavigate()
  const { data: years = [] } = useSellinYears()
  const [year, setYear] = useState(null)
  const activeYear = year || years[0] || new Date().getFullYear()

  const { data: rows = [], isLoading } = useSellinPivotYearly(activeYear)
  const { activeBrandId } = useActiveBrand()
  const [search, setSearch] = useState('')
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [selectedCustomers, setSelectedCustomers] = useState([])
  const [exporting, setExporting] = useState(false)

  const brandRows = useMemo(
    () => activeBrandId ? rows.filter(r => r.brand_id === activeBrandId) : rows,
    [rows, activeBrandId]
  )

  const allCustomerNames = useMemo(() => [...new Set(brandRows.map(r => r.company_name))].sort(), [brandRows])

  const effectiveCustomers = selectedCustomers.length > 0 ? selectedCustomers : allCustomerNames.slice(0, 3)

  const filteredRows = useMemo(() => {
    const q = search.toLowerCase().trim()
    return brandRows.filter(r => {
      if (!effectiveCustomers.includes(r.company_name)) return false
      if (q && !r.description.toLowerCase().includes(q) && !r.ean.includes(q)) return false
      return true
    })
  }, [brandRows, effectiveCustomers, search])

  // Prodotti distinti (righe della tabella)
  const products = useMemo(() => {
    const map = {}
    for (const r of filteredRows) {
      if (!map[r.product_id]) map[r.product_id] = { product_id: r.product_id, ean: r.ean, description: r.description }
    }
    return Object.values(map).sort((a, b) => a.description.localeCompare(b.description))
  }, [filteredRows])

  // Gruppi cliente, ciascuno con la mappa prodotto->dati e mesi effettivamente coperti
  const customerGroups = useMemo(() => {
    return effectiveCustomers.map(name => {
      const custRows = filteredRows.filter(r => r.company_name === name)
      const byProduct = {}
      for (const r of custRows) byProduct[r.product_id] = r
      const monthsCovered = custRows[0]?.total_months_covered || 0
      const numPoints = custRows[0]?.latest_num_points || 0
      return { name, byProduct, monthsCovered, numPoints }
    }).filter(g => Object.keys(g.byProduct).length > 0)
  }, [filteredRows, effectiveCustomers])

  const cols = MONTH_KEYS.map((key, i) => ({ key, label: MONTHS_SHORT[i] }))

  async function handleExport() {
    setExporting(true)
    try { await exportToExcel(products, customerGroups, cols, activeYear) }
    finally { setExporting(false) }
  }

  return (
    <div>
      <PageHeader
        title="Report Sell-in"
        description="Venduto per prodotto e cliente, aggregato su tutti gli import dell'anno selezionato"
        action={
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => navigate('/sellin/import')}>
              <Upload size={15} /> Nuovo import
            </button>
            <button className="btn-primary" onClick={handleExport} disabled={exporting || products.length === 0}>
              {exporting ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Download size={15} /> Esporta Excel</>}
            </button>
          </div>
        }
      />

      {/* Filtri */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <select className="input text-sm" style={{ width: 'auto', minWidth: '100px' }} value={activeYear} onChange={e => setYear(Number(e.target.value))}>
          {years.length === 0 && <option value={activeYear}>{activeYear}</option>}
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input className="input pl-8" style={{ width: '200px' }} placeholder="Cerca prodotto, EAN…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <button className="btn-secondary text-sm" onClick={() => setShowCustomerModal(true)}>
          <Users size={14} /> {selectedCustomers.length > 0 ? `Clienti (${selectedCustomers.length})` : `Clienti (${effectiveCustomers.length} di default)`}
        </button>
        {selectedCustomers.length > 0 && (
          <button className="text-sm hover:underline" style={{ color: 'var(--text-muted)' }} onClick={() => setSelectedCustomers([])}>
            Reset selezione
          </button>
        )}

        <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>{products.length} prodotti · {customerGroups.length} clienti visualizzati</span>
      </div>

      {selectedCustomers.length === 0 && allCustomerNames.length > 3 && (
        <div className="mb-4 px-4 py-2 rounded-lg text-xs" style={{ backgroundColor: 'var(--brand-50)', color: 'var(--brand)' }}>
          Vengono mostrati i primi 3 clienti per default (la tabella diventa molto larga con molti clienti). Usa il filtro "Clienti" per scegliere quali vedere.
        </div>
      )}

      {isLoading ? (
        <div className="card flex items-center justify-center py-16 text-sm" style={{ color: 'var(--text-muted)' }}>Caricamento…</div>
      ) : products.length === 0 || customerGroups.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-sm gap-3" style={{ color: 'var(--text-muted)' }}>
          <span>Nessun dato disponibile per i filtri selezionati.</span>
          <button className="btn-primary" onClick={() => navigate('/sellin/import')}><Upload size={14} /> Carica un import</button>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="text-xs" style={{ minWidth: `${400 + customerGroups.length * 13 * 55}px` }}>
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                <th className="text-left px-3 py-2 sticky left-0" style={{ backgroundColor: 'var(--alt-row)', color: 'var(--text-sub)' }} rowSpan={2}>EAN</th>
                <th className="text-left px-3 py-2 sticky left-0" style={{ backgroundColor: 'var(--alt-row)', color: 'var(--text-sub)', left: '90px' }} rowSpan={2}>Descrizione</th>
                {customerGroups.map(g => (
                  <th key={g.name} colSpan={cols.length + 1} className="text-center px-2 py-2 font-medium border-l" style={{ backgroundColor: 'var(--brand-50)', color: 'var(--brand)', borderColor: 'var(--border)' }}>
                    {g.name} <span className="font-normal" style={{ color: 'var(--text-muted)' }}>({g.numPoints} PDV)</span>
                  </th>
                ))}
              </tr>
              <tr className="border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--alt-row)' }}>
                {customerGroups.map(g => (
                  <React.Fragment key={g.name}>
                    {cols.map(c => <th key={`${g.name}-${c.key}`} className="text-right px-1.5 py-1.5 font-medium border-l" style={{ color: 'var(--text-sub)', borderColor: 'var(--border)' }}>{c.label}</th>)}
                    <th className="text-right px-1.5 py-1.5 font-medium" style={{ color: 'var(--brand)' }}>ROT.</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map((p, idx) => {
                const bg = idx % 2 === 1 ? 'var(--alt-row)' : 'var(--bg-card)'
                return (
                  <tr key={p.product_id} style={{ backgroundColor: bg, borderBottom: `1px solid var(--border)` }}>
                    <td className="px-3 py-1.5 font-mono sticky left-0" style={{ backgroundColor: bg, color: 'var(--text-muted)' }}>{p.ean}</td>
                    <td className="px-3 py-1.5 sticky left-0" style={{ backgroundColor: bg, color: 'var(--text-main)', left: '90px' }}>{p.description}</td>
                    {customerGroups.map(g => {
                      const rec = g.byProduct[p.product_id]
                      return (
                        <React.Fragment key={g.name}>
                          {cols.map(c => (
                            <td key={`${g.name}-${p.product_id}-${c.key}`} className="px-1.5 py-1.5 text-right border-l" style={{ color: 'var(--text-main)', borderColor: 'var(--border)' }}>
                              {rec ? fmt(rec[c.key]) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                            </td>
                          ))}
                          <td className="px-1.5 py-1.5 text-right font-medium" style={{ color: 'var(--brand)' }}>
                            {rec ? fmtRot(rec.rotation_avg) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </td>
                        </React.Fragment>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showCustomerModal && (
        <CustomerFilterModal
          allCustomers={allCustomerNames}
          selected={selectedCustomers}
          onClose={() => setShowCustomerModal(false)}
          onApply={(sel) => { setSelectedCustomers(sel); setShowCustomerModal(false) }}
        />
      )}
    </div>
  )
}
