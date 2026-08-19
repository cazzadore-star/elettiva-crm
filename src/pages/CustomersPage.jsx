import { useState } from 'react'
import { Plus, Search, Pencil, PowerOff, Power } from 'lucide-react'
import { useCustomers, useUpsertCustomer, useToggleCustomerActive } from '../hooks/useCustomers'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'
import { useCanEdit } from '../hooks/useUserRole'

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
  const canEdit = useCanEdit()

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

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Clienti"
        description="Gestione anagrafica clienti"
        action={
          canEdit ? (
            <button className="btn-primary" onClick={openNew}>
              <Plus size={16} /> Nuovo cliente
            </button>
          ) : null
        }
      />

      {/* Filtri */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input className="input pl-9" placeholder="Cerca per ragione sociale…" value={search} onChange={e => setSearch(e.target.value)} />
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
            <span>Nessun cliente trovato.</span>
            {!search && canEdit && (
              <button className="btn-primary mt-2" onClick={openNew}><Plus size={15} /> Aggiungi il primo cliente</button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--alt-row)' }}>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-sub)' }}>Ragione sociale</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-sub)' }}>Stato</th>
                {canEdit && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {filtered.map((customer, idx) => {
                const bg = idx % 2 === 1 ? 'var(--alt-row)' : 'var(--bg-card)'
                return (
                  <tr
                    key={customer.id}
                    style={{ backgroundColor: bg, borderBottom: `1px solid var(--border)` }}
                    onMouseEnter={e => Array.from(e.currentTarget.cells).forEach(td => td.style.backgroundColor = 'var(--hover-row)')}
                    onMouseLeave={e => Array.from(e.currentTarget.cells).forEach(td => td.style.backgroundColor = bg)}
                  >
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-main)' }}>{customer.company_name}</td>
                    <td className="px-4 py-3">
                      {customer.active
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Attivo</span>
                        : <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">Disattivato</span>
                      }
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(customer)}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: 'var(--text-muted)' }}
                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--brand)'; e.currentTarget.style.backgroundColor = 'var(--brand-50)' }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent' }}
                            title="Modifica"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => toggle.mutateAsync({ id: customer.id, active: !customer.active })}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: 'var(--text-muted)' }}
                            onMouseEnter={e => { e.currentTarget.style.color = customer.active ? '#dc2626' : '#16a34a'; e.currentTarget.style.backgroundColor = customer.active ? '#fee2e2' : '#dcfce7' }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent' }}
                            title={customer.active ? 'Disattiva' : 'Riattiva'}
                          >
                            {customer.active ? <PowerOff size={15} /> : <Power size={15} />}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {filtered.length > 0 && (
        <p className="text-xs mt-2 px-1" style={{ color: 'var(--text-muted)' }}>
          {filtered.length} client{filtered.length === 1 ? 'e' : 'i'}
        </p>
      )}

      {modalOpen && (
        <Modal title={form.id ? 'Modifica cliente' : 'Nuovo cliente'} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Ragione sociale</label>
              <input className="input" placeholder="es. Supermercati Rossi Srl" value={form.company_name}
                onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} autoFocus />
            </div>
            {formError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Annulla</button>
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
