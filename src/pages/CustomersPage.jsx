import { useState } from 'react'
import { Plus, Search, Pencil, PowerOff, Power } from 'lucide-react'
import { useCustomers, useUpsertCustomer, useToggleCustomerActive } from '../hooks/useCustomers'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'

const EMPTY_FORM = { company_name: '' }

export default function CustomersPage() {
  const [search, setSearch]             = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [modalOpen, setModalOpen]       = useState(false)
  const [form, setForm]                 = useState(EMPTY_FORM)
  const [formError, setFormError]       = useState('')

  const { data: customers = [], isLoading } = useCustomers({ includeInactive: showInactive })
  const upsert = useUpsertCustomer()
  const toggle = useToggleCustomerActive()

  const filtered = customers.filter(c =>
    c.company_name.toLowerCase().includes(search.toLowerCase())
  )

  function openNew() {
    setForm(EMPTY_FORM)
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(customer) {
    setForm({ id: customer.id, company_name: customer.company_name, active: customer.active })
    setFormError('')
    setModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')
    if (!form.company_name.trim()) return setFormError('Ragione sociale obbligatoria.')

    try {
      await upsert.mutateAsync(form)
      setModalOpen(false)
    } catch (err) {
      if (err.message?.includes('customers_company_name_unique')) {
        setFormError('Esiste già un cliente con questa ragione sociale.')
      } else {
        setFormError('Errore nel salvataggio. Riprova.')
      }
    }
  }

  async function handleToggle(customer) {
    await toggle.mutateAsync({ id: customer.id, active: !customer.active })
  }

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Clienti"
        description="Gestione anagrafica clienti"
        action={
          <button className="btn-primary" onClick={openNew}>
            <Plus size={16} /> Nuovo cliente
          </button>
        }
      />

      {/* Filtri */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Cerca per ragione sociale…"
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
            <span>Nessun cliente trovato.</span>
            {!search && (
              <button className="btn-primary mt-2" onClick={openNew}>
                <Plus size={15} /> Aggiungi il primo cliente
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Ragione sociale</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Stato</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((customer, idx) => (
                <tr key={customer.id} className={`${idx % 2 === 0 ? 'table-row-even' : 'table-row-odd'} transition-colors`}>
                  <td className="px-4 py-3 text-gray-900 font-medium">{customer.company_name}</td>
                  <td className="px-4 py-3">
                    {customer.active
                      ? <span className="badge-active">Attivo</span>
                      : <span className="badge-inactive">Disattivato</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(customer)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                        title="Modifica"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleToggle(customer)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          customer.active
                            ? 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                            : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                        }`}
                        title={customer.active ? 'Disattiva' : 'Riattiva'}
                      >
                        {customer.active ? <PowerOff size={15} /> : <Power size={15} />}
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
          {filtered.length} client{filtered.length === 1 ? 'e' : 'i'}
        </p>
      )}

      {modalOpen && (
        <Modal
          title={form.id ? 'Modifica cliente' : 'Nuovo cliente'}
          onClose={() => setModalOpen(false)}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="max-w-5xl mx-auto">
              <label className="label">Ragione sociale</label>
              <input
                className="input"
                placeholder="es. Supermercati Rossi Srl"
                value={form.company_name}
                onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                autoFocus
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
                  : form.id ? 'Salva modifiche' : 'Crea cliente'
                }
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
