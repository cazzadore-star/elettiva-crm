import { useState } from 'react'
import { Plus, Search, Pencil, PowerOff, Power } from 'lucide-react'
import { usePriceLists, useUpsertPriceList, useTogglePriceListActive } from '../hooks/usePriceLists'
import { useCustomers } from '../hooks/useCustomers'
import { useProducts } from '../hooks/useProducts'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'

const EMPTY_FORM = { customer_id: '', product_id: '', avg_price: '' }

function fmt(n) {
  return Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

export default function PriceListsPage() {
  const [search, setSearch]             = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [modalOpen, setModalOpen]       = useState(false)
  const [form, setForm]                 = useState(EMPTY_FORM)
  const [formError, setFormError]       = useState('')

  const { data: priceLists = [], isLoading } = usePriceLists({ includeInactive: showInactive })
  const { data: customers = [] }             = useCustomers()
  const { data: products = [] }              = useProducts()
  const upsert = useUpsertPriceList()
  const toggle = useTogglePriceListActive()

  const filtered = priceLists.filter(pl => {
    const q = search.toLowerCase()
    return (
      pl.customers?.company_name.toLowerCase().includes(q) ||
      pl.products?.description.toLowerCase().includes(q) ||
      pl.products?.ean.includes(q)
    )
  })

  function openNew() {
    setForm(EMPTY_FORM)
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(pl) {
    setForm({
      id:          pl.id,
      customer_id: pl.customer_id,
      product_id:  pl.product_id,
      avg_price:   pl.avg_price,
      active:      pl.active,
    })
    setFormError('')
    setModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')
    if (!form.customer_id)              return setFormError('Seleziona un cliente.')
    if (!form.product_id)               return setFormError('Seleziona un prodotto.')
    if (!form.avg_price || Number(form.avg_price) <= 0)
                                        return setFormError('Inserisci un prezzo valido (> 0).')
    try {
      await upsert.mutateAsync({ ...form, avg_price: Number(form.avg_price) })
      setModalOpen(false)
    } catch (err) {
      setFormError('Errore nel salvataggio. Riprova.')
    }
  }

  async function handleToggle(pl) {
    await toggle.mutateAsync({ id: pl.id, active: !pl.active })
  }

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Listini medi"
        description="Prezzi medi per combinazione cliente + prodotto"
        action={
          <button className="btn-primary" onClick={openNew}>
            <Plus size={16} /> Nuovo listino
          </button>
        }
      />

      {/* Filtri */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Cerca per cliente, prodotto o EAN…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={e => setShowInactive(e.target.checked)}
            className="rounded border-gray-300"
          />
          Mostra disattivati
        </label>
      </div>

      {/* Tabella */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
            Caricamento…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 text-sm gap-2">
            <span>Nessun listino trovato.</span>
            {!search && (
              <button className="btn-primary mt-2" onClick={openNew}>
                <Plus size={15} /> Aggiungi il primo listino
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Cliente</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Prodotto</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">EAN</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Listino medio €</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Stato</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((pl, idx) => (
                <tr key={pl.id} className={`${idx % 2 === 0 ? 'table-row-even' : 'table-row-odd'} transition-colors`}>
                  <td className="px-4 py-3 text-gray-900">{pl.customers?.company_name}</td>
                  <td className="px-4 py-3 text-gray-700">{pl.products?.description}</td>
                  <td className="px-4 py-3 font-mono text-gray-500 text-xs">{pl.products?.ean}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{fmt(pl.avg_price)}</td>
                  <td className="px-4 py-3">
                    {pl.active
                      ? <span className="badge-active">Attivo</span>
                      : <span className="badge-inactive">Disattivato</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(pl)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                        title="Modifica prezzo"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleToggle(pl)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          pl.active
                            ? 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                            : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                        }`}
                        title={pl.active ? 'Disattiva' : 'Riattiva'}
                      >
                        {pl.active ? <PowerOff size={15} /> : <Power size={15} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-gray-400 mt-2 px-1">
          {filtered.length} listin{filtered.length === 1 ? 'o' : 'i'}
        </p>
      )}

      {/* Modal */}
      {modalOpen && (
        <Modal
          title={form.id ? 'Modifica listino' : 'Nuovo listino'}
          onClose={() => setModalOpen(false)}
        >
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Cliente */}
            <div className="max-w-5xl mx-auto">
              <label className="label">Cliente</label>
              <select
                className="input"
                value={form.customer_id}
                onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}
                disabled={!!form.id}
              >
                <option value="">— Seleziona cliente —</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.company_name}</option>
                ))}
              </select>
            </div>

            {/* Prodotto */}
            <div className="max-w-5xl mx-auto">
              <label className="label">Prodotto</label>
              <select
                className="input"
                value={form.product_id}
                onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}
                disabled={!!form.id}
              >
                <option value="">— Seleziona prodotto —</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.description} — {p.ean}</option>
                ))}
              </select>
              {form.id && (
                <p className="text-xs text-gray-400 mt-1">Cliente e prodotto non modificabili. Crea un nuovo listino per cambiare la combinazione.</p>
              )}
            </div>

            {/* Prezzo */}
            <div className="max-w-5xl mx-auto">
              <label className="label">Listino medio (€)</label>
              <input
                className="input"
                type="number"
                step="0.0001"
                min="0.0001"
                placeholder="es. 4.5000"
                value={form.avg_price}
                onChange={e => setForm(f => ({ ...f, avg_price: e.target.value }))}
                autoFocus={!!form.id}
              />
            </div>

            {formError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {formError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
                Annulla
              </button>
              <button type="submit" className="btn-primary" disabled={upsert.isPending}>
                {upsert.isPending
                  ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : form.id ? 'Salva modifiche' : 'Crea listino'
                }
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
