import { useState, useEffect } from 'react'
import { Plus, Trash2, Copy, Pencil } from 'lucide-react'
import { useRotations, useProductsWithRotationInfo, useCreateRotation, useUpdateRotation, useDeleteRotation } from '../hooks/useRotations'
import { useCustomers } from '../hooks/useCustomers'
import { useSettings } from '../hooks/useSettings'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'
import { useCanEdit } from '../hooks/useUserRole'

const FREQUENCY_LABELS = {
  monthly:       'Mensile',
  bimonthly:     'Bimestrale',
  quarterly:     'Trimestrale',
  quadrimestral: 'Quadrimestrale',
}

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
}

function calcMonths(startDate, endDate, frequency) {
  if (!startDate || !endDate || !frequency) return []
  const step = { monthly: 1, bimonthly: 2, quarterly: 3, quadrimestral: 4 }[frequency]
  const startMonth = new Date(startDate).getMonth() + 1
  const endMonth   = new Date(endDate).getMonth() + 1
  const months = []
  const MONTH_NAMES = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']
  for (let m = startMonth; m <= endMonth; m += step) months.push(MONTH_NAMES[m - 1])
  return months
}

function RotationModal({ mode, initialData, onClose, onSave }) {
  const { data: settings } = useSettings()
  const { data: customers = [] } = useCustomers()

  const [form, setForm] = useState({
    customer_id:    initialData?.customer_id    || '',
    num_points:     initialData?.num_points      || '',
    rotation_value: initialData?.rotation_value  || '',
    frequency:      initialData?.frequency       || 'bimonthly',
    period_start:   initialData?.period_start    || '',
    period_end:     initialData?.period_end      || '',
    notes:          initialData?.notes           || '',
  })

  useEffect(() => {
    if (settings && !initialData) {
      setForm(f => ({
        ...f,
        rotation_value: f.rotation_value || settings.default_rotation || '',
        period_start:   f.period_start   || settings.period_start     || '',
        period_end:     f.period_end     || settings.period_end       || '',
      }))
    }
  }, [settings])

  const [selectedProducts, setSelectedProducts] = useState(initialData?.products?.map(p => p.product_id) || [])
  const [error, setError]       = useState('')
  const [saving, setSaving]     = useState(false)
  const [productSearch, setProductSearch] = useState('')

  const { data: products = [] } = useProductsWithRotationInfo(form.customer_id)

  const filteredProducts = products.filter(p => {
    if (!productSearch) return true
    const q = productSearch.toLowerCase()
    return p.description.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q) || p.ean.includes(q)
  })

  function toggleProduct(pid) {
    setSelectedProducts(prev => prev.includes(pid) ? prev.filter(p => p !== pid) : [...prev, pid])
  }

  const titles = { new: 'Nuova rotazione', edit: 'Modifica rotazione', duplicate: 'Duplica rotazione' }

  async function handleSubmit(e) {
    e.preventDefault(); setError('')
    if (!form.customer_id)   return setError('Seleziona un cliente.')
    if (!form.num_points || Number(form.num_points) <= 0) return setError('Inserisci il numero di punti vendita.')
    if (!form.rotation_value || Number(form.rotation_value) <= 0) return setError('Inserisci il valore di rotazione.')
    if (!form.period_start)  return setError('Inserisci la data di inizio.')
    if (!form.period_end)    return setError('Inserisci la data di fine.')
    if (form.period_end <= form.period_start) return setError('La data di fine deve essere successiva alla data di inizio.')
    if (selectedProducts.length === 0) return setError('Seleziona almeno un prodotto.')
    setSaving(true)
    try {
      await onSave({
        id: mode === 'edit' ? initialData.id : undefined,
        rotation: {
          customer_id:    Number(form.customer_id),
          num_points:     Number(form.num_points),
          rotation_value: Number(form.rotation_value),
          frequency:      form.frequency,
          period_start:   form.period_start,
          period_end:     form.period_end,
          notes:          form.notes || null,
        },
        productIds: selectedProducts,
      })
      onClose()
    } catch (err) {
      setError('Errore nel salvataggio: ' + (err.message || 'riprova.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={titles[mode]} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1" style={{ minWidth: '720px' }}>

        {/* Riga 1: Cliente | Punti vendita | Rotazione */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Cliente</label>
            <select className="input" value={form.customer_id}
              onChange={e => { setForm(f => ({ ...f, customer_id: e.target.value })); setSelectedProducts([]) }}
              disabled={mode === 'edit'}>
              <option value="">— Seleziona —</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
            {mode === 'edit' && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Non modificabile.</p>}
          </div>
          <div>
            <label className="label">Punti vendita</label>
            <input type="number" min="1" step="1" className="input" placeholder="es. 100"
              value={form.num_points} onChange={e => setForm(f => ({ ...f, num_points: e.target.value }))} />
          </div>
          <div>
            <label className="label">Rotazione (pz/pdv)</label>
            <input type="number" min="0.1" step="0.1" className="input" placeholder="es. 2.5"
              value={form.rotation_value} onChange={e => setForm(f => ({ ...f, rotation_value: e.target.value }))} />
          </div>
        </div>

        {/* Riga 2: Inizio | Fine | Periodicità */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Inizio periodo</label>
            <input type="date" className="input" value={form.period_start}
              onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))} />
          </div>
          <div>
            <label className="label">Fine periodo</label>
            <input type="date" className="input" value={form.period_end}
              onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))} />
          </div>
          <div>
            <label className="label">Periodicità</label>
            <select className="input" value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
              <option value="monthly">Mensile</option>
              <option value="bimonthly">Bimestrale</option>
              <option value="quarterly">Trimestrale</option>
              <option value="quadrimestral">Quadrimestrale</option>
            </select>
          </div>
        </div>

        {/* Prodotti */}
        {form.customer_id && (
          <div>
            <label className="label">
              Prodotti
              {selectedProducts.length > 0 && (
                <span className="ml-2 text-xs font-normal" style={{ color: 'var(--brand)' }}>{selectedProducts.length} selezionati</span>
              )}
            </label>
            <div className="relative mb-1.5">
              <input type="text" className="input pl-8 text-xs" placeholder="Cerca prodotto, SKU, EAN…"
                value={productSearch} onChange={e => setProductSearch(e.target.value)} />
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            </div>
            <div className="rounded-lg max-h-52 overflow-y-auto divide-y" style={{ border: `1px solid var(--border)` }}>
              {filteredProducts.length === 0 ? (
                <p className="text-sm px-3 py-4 text-center" style={{ color: 'var(--text-muted)' }}>Nessun prodotto trovato.</p>
              ) : filteredProducts.map(p => (
                <label key={p.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors"
                  style={{
                    backgroundColor: selectedProducts.includes(p.id)
                      ? 'var(--brand-50)'
                      : p.inRotation && !selectedProducts.includes(p.id)
                        ? 'rgba(249,115,22,0.08)'
                        : 'transparent',
                    borderColor: 'var(--border)'
                  }}>
                  <input type="checkbox" checked={selectedProducts.includes(p.id)}
                    onChange={() => toggleProduct(p.id)} className="rounded shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm" style={{ color: 'var(--text-main)' }}>{p.description}</span>
                    {p.sku && <span className="text-xs ml-1.5" style={{ color: 'var(--text-muted)' }}>{p.sku}</span>}
                  </div>
                  {p.inRotation && !selectedProducts.includes(p.id) && (
                    <span className="text-xs bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded shrink-0">{p.rotationPeriod}</span>
                  )}
                </label>
              ))}
            </div>
            <div className="flex gap-2 mt-1.5">
              <button type="button" className="text-xs hover:underline" style={{ color: 'var(--brand)' }}
                onClick={() => setSelectedProducts(products.map(p => p.id))}>Seleziona tutti</button>
              <span style={{ color: 'var(--border)' }}>·</span>
              <button type="button" className="text-xs hover:underline" style={{ color: 'var(--text-muted)' }}
                onClick={() => setSelectedProducts([])}>Deseleziona tutti</button>
            </div>
          </div>
        )}

        {/* Note */}
        <div>
          <label className="label">Note (opzionale)</label>
          <input type="text" className="input" placeholder="es. Ordine estivo"
            value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Annulla</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : mode === 'edit' ? 'Salva modifiche' : 'Salva e applica al Forecast'
            }
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function RotationsPage() {
  const [modal, setModal]               = useState(null)
  const [filterCustomer, setFilterCustomer] = useState('')

  const { data: rotations = [], isLoading } = useRotations()
  const { data: customers = [] }            = useCustomers()
  const createRotation = useCreateRotation()
  const updateRotation = useUpdateRotation()
  const deleteRotation = useDeleteRotation()
  const canEdit = useCanEdit()

  const filtered = rotations.filter(r => !filterCustomer || String(r.customer_id) === filterCustomer)

  async function handleSave({ id, rotation, productIds }) {
    if (id) await updateRotation.mutateAsync({ id, rotation, productIds })
    else    await createRotation.mutateAsync({ rotation, productIds })
  }

  async function handleDelete(rotation) {
    if (!confirm(`Eliminare la rotazione per "${rotation.company_name}"?\nI valori nel Forecast NON verranno rimossi.`)) return
    await deleteRotation.mutateAsync(rotation.id)
  }

  return (
    <div>
      <PageHeader
        title="Rotazioni"
        description="Previsioni di ordine periodiche per cliente e prodotti"
        action={
          canEdit ? (
            <button className="btn-primary" onClick={() => setModal({ mode: 'new', data: null })}>
              <Plus size={16} /> Nuova rotazione
            </button>
          ) : null
        }
      />

      {/* Filtro cliente */}
      <div className="flex items-center gap-3 mb-4">
        <select className="input max-w-xs" value={filterCustomer} onChange={e => setFilterCustomer(e.target.value)}>
          <option value="">Tutti i clienti</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
        </select>
        {filterCustomer && (
          <button className="text-sm hover:underline" style={{ color: 'var(--text-muted)' }} onClick={() => setFilterCustomer('')}>
            Rimuovi filtro
          </button>
        )}
      </div>

      {/* Lista */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-sm" style={{ color: 'var(--text-muted)' }}>Caricamento…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-sm gap-2" style={{ color: 'var(--text-muted)' }}>
            <span>Nessuna rotazione trovata.</span>
            {canEdit && (
              <button className="btn-primary mt-2" onClick={() => setModal({ mode: 'new', data: null })}>
                <Plus size={15} /> Crea la prima rotazione
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--alt-row)' }}>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-sub)' }}>Cliente</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-sub)' }}>Periodo</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-sub)' }}>Frequenza</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--text-sub)' }}>PDV</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--text-sub)' }}>Rot.</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--text-sub)' }}>Pz/periodo</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-sub)' }}>Prodotti</th>
                {canEdit && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {filtered.map((rotation, idx) => {
                const bg = idx % 2 === 1 ? 'var(--alt-row)' : 'var(--bg-card)'
                const previewMonths = calcMonths(rotation.period_start, rotation.period_end, rotation.frequency)
                return (
                  <tr key={rotation.id} style={{ backgroundColor: bg, borderBottom: `1px solid var(--border)` }}
                    onMouseEnter={e => Array.from(e.currentTarget.cells).forEach(td => td.style.backgroundColor = 'var(--hover-row)')}
                    onMouseLeave={e => Array.from(e.currentTarget.cells).forEach(td => td.style.backgroundColor = bg)}>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-main)' }}>{rotation.company_name}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-sub)' }}>
                      {formatDate(rotation.period_start)} → {formatDate(rotation.period_end)}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {previewMonths.map(m => (
                          <span key={m} className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--brand-50)', color: 'var(--brand)' }}>{m}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-sub)' }}>{FREQUENCY_LABELS[rotation.frequency]}</td>
                    <td className="px-4 py-3 text-right" style={{ color: 'var(--text-main)' }}>{rotation.num_points}</td>
                    <td className="px-4 py-3 text-right" style={{ color: 'var(--text-main)' }}>{rotation.rotation_value}</td>
                    <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--text-main)' }}>
                      {(rotation.num_points * rotation.rotation_value).toLocaleString('it-IT')}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-sub)' }}>
                      <span className="font-medium" style={{ color: 'var(--text-main)' }}>{rotation.product_count}</span> prodotti
                      {rotation.notes && <div className="mt-0.5 italic" style={{ color: 'var(--text-muted)' }}>{rotation.notes}</div>}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {[
                            { icon: Pencil, title: 'Modifica', action: () => setModal({ mode: 'edit', data: rotation }) },
                            { icon: Copy,   title: 'Duplica',  action: () => setModal({ mode: 'duplicate', data: rotation }) },
                            { icon: Trash2, title: 'Elimina',  action: () => handleDelete(rotation), red: true },
                          ].map(({ icon: Icon, title, action, red }) => (
                            <button key={title} onClick={action} title={title}
                              className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}
                              onMouseEnter={e => { e.currentTarget.style.color = red ? '#dc2626' : 'var(--brand)'; e.currentTarget.style.backgroundColor = red ? '#fee2e2' : 'var(--brand-50)' }}
                              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent' }}>
                              <Icon size={14} />
                            </button>
                          ))}
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
          {filtered.length} rotazion{filtered.length === 1 ? 'e' : 'i'}
        </p>
      )}

      {modal && (
        <RotationModal
          mode={modal.mode}
          initialData={modal.data}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
