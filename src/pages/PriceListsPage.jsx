import { useState } from 'react'
import { Plus, Search, Pencil, PowerOff, Power, RefreshCw } from 'lucide-react'
import { usePriceLists, useUpsertPriceList, useTogglePriceListActive, useBulkUpdatePriceList } from '../hooks/usePriceLists'
import { useCustomers } from '../hooks/useCustomers'
import { useProducts } from '../hooks/useProducts'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'

const EMPTY_FORM = { customer_id: '', product_id: '', avg_price: '', selectedProducts: [], productSearch: '' }

function fmt(n) {
  return Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

export default function PriceListsPage() {
  const [search, setSearch]               = useState('')
  const [showInactive, setShowInactive]   = useState(false)
  const [modalOpen, setModalOpen]         = useState(false)
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [form, setForm]                   = useState(EMPTY_FORM)
  const [formError, setFormError]         = useState('')
  const [bulkForm, setBulkForm]           = useState({ customer_id: '', avg_price: '' })
  const [bulkError, setBulkError]         = useState('')
  const [bulkDone, setBulkDone]           = useState(false)

  const { data: priceLists = [], isLoading } = usePriceLists({ includeInactive: showInactive })
  const { data: customers = [] }             = useCustomers()
  const { data: products = [] }              = useProducts()
  const upsert     = useUpsertPriceList()
  const toggle     = useTogglePriceListActive()
  const bulkUpdate = useBulkUpdatePriceList()

  const filtered = priceLists.filter(pl => {
    const q = search.toLowerCase()
    return (
      pl.customers?.company_name.toLowerCase().includes(q) ||
      pl.products?.description.toLowerCase().includes(q) ||
      pl.products?.ean.includes(q)
    )
  })

  function openNew() { setForm(EMPTY_FORM); setFormError(''); setModalOpen(true) }

  function openEdit(pl) {
    setForm({ id: pl.id, customer_id: pl.customer_id, product_id: pl.product_id, avg_price: pl.avg_price, active: pl.active })
    setFormError(''); setModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault(); setFormError('')
    if (!form.customer_id) return setFormError('Seleziona un cliente.')
    if (!form.avg_price || Number(form.avg_price) <= 0) return setFormError('Inserisci un prezzo valido (> 0).')
    if (form.id) {
      try { await upsert.mutateAsync({ ...form, avg_price: Number(form.avg_price) }); setModalOpen(false) }
      catch { setFormError('Errore nel salvataggio. Riprova.') }
    } else {
      const selectedIds = form.selectedProducts || []
      if (selectedIds.length === 0) return setFormError('Seleziona almeno un prodotto.')
      try {
        for (const product_id of selectedIds) await upsert.mutateAsync({ customer_id: form.customer_id, product_id, avg_price: Number(form.avg_price) })
        setModalOpen(false)
      } catch { setFormError('Errore nel salvataggio. Riprova.') }
    }
  }

  async function handleBulkSubmit(e) {
    e.preventDefault(); setBulkError(''); setBulkDone(false)
    if (!bulkForm.customer_id) return setBulkError('Seleziona un cliente.')
    if (!bulkForm.avg_price || Number(bulkForm.avg_price) <= 0) return setBulkError('Inserisci un prezzo valido (> 0).')
    const count = priceLists.filter(pl => String(pl.customer_id) === bulkForm.customer_id).length
    if (count === 0) return setBulkError('Nessun listino attivo trovato per questo cliente.')
    if (!confirm(`Aggiornare il listino di ${count} prodotti a € ${Number(bulkForm.avg_price).toFixed(4)}?`)) return
    try {
      await bulkUpdate.mutateAsync({ customer_id: Number(bulkForm.customer_id), avg_price: Number(bulkForm.avg_price) })
      setBulkDone(true)
      setTimeout(() => { setBulkModalOpen(false); setBulkDone(false); setBulkForm({ customer_id: '', avg_price: '' }) }, 1500)
    } catch { setBulkError("Errore durante l'aggiornamento. Riprova.") }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Listini medi"
        description="Prezzi medi per combinazione cliente + prodotto"
        action={
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => { setBulkModalOpen(true); setBulkError(''); setBulkDone(false) }}>
              <RefreshCw size={15} /> Aggiorna listino
            </button>
            <button className="btn-primary" onClick={openNew}><Plus size={16} /> Nuovo listino</button>
          </div>
        }
      />

      {/* Filtri */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input className="input pl-9" placeholder="Cerca per cliente, prodotto o EAN…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none" style={{ color: 'var(--text-sub)' }}>
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="rounded" />
          Mostra disattivati
        </label>
      </div>

      {/* Tabella */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-sm" style={{ color: 'var(--text-muted)' }}>Caricamento…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-sm gap-2" style={{ color: 'var(--text-muted)' }}>
            <span>Nessun listino trovato.</span>
            {!search && <button className="btn-primary mt-2" onClick={openNew}><Plus size={15} /> Aggiungi il primo listino</button>}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--alt-row)' }}>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-sub)' }}>Cliente</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-sub)' }}>Prodotto</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-sub)' }}>EAN</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--text-sub)' }}>Listino medio €</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-sub)' }}>Stato</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((pl, idx) => {
                const bg = idx % 2 === 1 ? 'var(--alt-row)' : 'var(--bg-card)'
                return (
                  <tr key={pl.id} style={{ backgroundColor: bg, borderBottom: `1px solid var(--border)` }}
                    onMouseEnter={e => Array.from(e.currentTarget.cells).forEach(td => td.style.backgroundColor = 'var(--hover-row)')}
                    onMouseLeave={e => Array.from(e.currentTarget.cells).forEach(td => td.style.backgroundColor = bg)}>
                    <td className="px-4 py-3" style={{ color: 'var(--text-main)' }}>{pl.customers?.company_name}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-sub)' }}>{pl.products?.description}</td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{pl.products?.ean}</td>
                    <td className="px-4 py-3 text-right font-medium" style={{ color: 'var(--text-main)' }}>{fmt(pl.avg_price)}</td>
                    <td className="px-4 py-3">
                      {pl.active
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Attivo</span>
                        : <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">Disattivato</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(pl)} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={e => { e.currentTarget.style.color = 'var(--brand)'; e.currentTarget.style.backgroundColor = 'var(--brand-50)' }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent' }}
                          title="Modifica prezzo"><Pencil size={15} /></button>
                        <button onClick={() => toggle.mutateAsync({ id: pl.id, active: !pl.active })} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={e => { e.currentTarget.style.color = pl.active ? '#dc2626' : '#16a34a'; e.currentTarget.style.backgroundColor = pl.active ? '#fee2e2' : '#dcfce7' }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent' }}
                          title={pl.active ? 'Disattiva' : 'Riattiva'}>
                          {pl.active ? <PowerOff size={15} /> : <Power size={15} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {filtered.length > 0 && (
        <p className="text-xs mt-2 px-1" style={{ color: 'var(--text-muted)' }}>
          {filtered.length} listin{filtered.length === 1 ? 'o' : 'i'}
        </p>
      )}

      {/* Modal nuovo/modifica listino */}
      {modalOpen && (
        <Modal title={form.id ? 'Modifica listino' : 'Nuovo listino'} onClose={() => setModalOpen(false)} wide={!form.id}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Cliente</label>
              <select className="input" value={form.customer_id}
                onChange={e => setForm(f => ({ ...f, customer_id: e.target.value, selectedProducts: [] }))} disabled={!!form.id}>
                <option value="">— Seleziona cliente —</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </div>

            {form.id ? (
              <div>
                <label className="label">Prodotto</label>
                <select className="input" value={form.product_id} disabled>
                  {products.map(p => <option key={p.id} value={p.id}>{p.description} — {p.ean}</option>)}
                </select>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Cliente e prodotto non modificabili.</p>
              </div>
            ) : (
              <div>
                <label className="label">
                  Prodotti
                  {form.selectedProducts?.length > 0 && (
                    <span className="ml-2 text-xs font-normal" style={{ color: 'var(--brand)' }}>{form.selectedProducts.length} selezionati</span>
                  )}
                </label>
                <div className="relative mb-1.5">
                  <input type="text" className="input pl-8 text-xs" placeholder="Cerca prodotto, EAN…"
                    value={form.productSearch || ''} onChange={e => setForm(f => ({ ...f, productSearch: e.target.value }))} />
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                </div>
                <div className="rounded-lg max-h-52 overflow-y-auto divide-y" style={{ border: `1px solid var(--border)`, borderColor: 'var(--border)' }}>
                  {products.filter(p => {
                    const q = (form.productSearch || '').toLowerCase()
                    return !q || p.description.toLowerCase().includes(q) || p.ean.includes(q)
                  }).map(p => (
                    <label key={p.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors"
                      style={{ backgroundColor: (form.selectedProducts || []).includes(p.id) ? 'var(--brand-50)' : 'transparent' }}>
                      <input type="checkbox" checked={(form.selectedProducts || []).includes(p.id)}
                        onChange={() => setForm(f => {
                          const sel = f.selectedProducts || []
                          return { ...f, selectedProducts: sel.includes(p.id) ? sel.filter(id => id !== p.id) : [...sel, p.id] }
                        })} className="rounded shrink-0" />
                      <span className="text-sm flex-1" style={{ color: 'var(--text-main)' }}>{p.description}</span>
                      <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{p.ean}</span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2 mt-1.5">
                  <button type="button" className="text-xs hover:underline" style={{ color: 'var(--brand)' }}
                    onClick={() => setForm(f => ({ ...f, selectedProducts: products.map(p => p.id) }))}>Seleziona tutti</button>
                  <span style={{ color: 'var(--border)' }}>·</span>
                  <button type="button" className="text-xs hover:underline" style={{ color: 'var(--text-muted)' }}
                    onClick={() => setForm(f => ({ ...f, selectedProducts: [] }))}>Deseleziona tutti</button>
                </div>
              </div>
            )}

            <div>
              <label className="label">Listino medio (€)</label>
              <input className="input" type="number" step="0.0001" min="0.0001" placeholder="es. 4.5000"
                value={form.avg_price} onChange={e => setForm(f => ({ ...f, avg_price: e.target.value }))} autoFocus={!!form.id} />
            </div>

            {formError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Annulla</button>
              <button type="submit" className="btn-primary" disabled={upsert.isPending}>
                {upsert.isPending ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : form.id ? 'Salva modifiche' : `Crea listino${(form.selectedProducts?.length || 0) > 1 ? ` (${form.selectedProducts.length} prodotti)` : ''}`}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal aggiornamento massivo */}
      {bulkModalOpen && (
        <Modal title="Aggiorna listino cliente" onClose={() => setBulkModalOpen(false)}>
          <form onSubmit={handleBulkSubmit} className="space-y-4">
            <div>
              <label className="label">Cliente</label>
              <select className="input" value={bulkForm.customer_id}
                onChange={e => setBulkForm(f => ({ ...f, customer_id: e.target.value }))} autoFocus>
                <option value="">— Seleziona cliente —</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
              {bulkForm.customer_id && (
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {priceLists.filter(pl => String(pl.customer_id) === bulkForm.customer_id).length} listini attivi verranno aggiornati.
                </p>
              )}
            </div>
            <div>
              <label className="label">Nuovo listino medio (€)</label>
              <input className="input" type="number" step="0.0001" min="0.0001" placeholder="es. 4.5000"
                value={bulkForm.avg_price} onChange={e => setBulkForm(f => ({ ...f, avg_price: e.target.value }))} />
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Sostituirà il listino medio di tutti i prodotti attivi del cliente selezionato.
              </p>
            </div>
            {bulkError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{bulkError}</p>}
            {bulkDone  && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">✓ Listini aggiornati con successo.</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setBulkModalOpen(false)}>Annulla</button>
              <button type="submit" className="btn-primary" disabled={bulkUpdate.isPending}>
                {bulkUpdate.isPending ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : 'Aggiorna tutti i listini'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
