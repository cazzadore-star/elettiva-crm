import { useState } from 'react'
import { Plus, Trash2, Copy, Pencil } from 'lucide-react'
import { useRotations, useProductsWithRotationInfo, useCreateRotation, useUpdateRotation, useDeleteRotation } from '../hooks/useRotations'
import { useCustomers } from '../hooks/useCustomers'
import { useSettings } from '../hooks/useSettings'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'

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
  for (let m = startMonth; m <= endMonth; m += step) {
    months.push(MONTH_NAMES[m - 1])
  }
  return months
}

// mode: 'new' | 'edit' | 'duplicate'
function RotationModal({ mode, initialData, onClose, onSave }) {
  const { data: settings } = useSettings()
  const { data: customers = [] } = useCustomers()

  const [form, setForm] = useState({
    customer_id:    initialData?.customer_id    || '',
    num_points:     initialData?.num_points      || '',
    rotation_value: initialData?.rotation_value  || settings?.default_rotation || '',
    frequency:      initialData?.frequency       || 'bimonthly',
    period_start:   initialData?.period_start    || settings?.period_start || '',
    period_end:     initialData?.period_end      || settings?.period_end   || '',
    notes:          initialData?.notes           || '',
  })
  const [selectedProducts, setSelectedProducts] = useState(
    initialData?.products?.map(p => p.product_id) || []
  )
  const [error, setError]   = useState('')
  const [saving, setSaving] = useState(false)

  const { data: products = [] } = useProductsWithRotationInfo(form.customer_id)

  const previewMonths   = calcMonths(form.period_start, form.period_end, form.frequency)
  const piecesPerPeriod = form.num_points && form.rotation_value
    ? Number(form.num_points) * Number(form.rotation_value)
    : 0

  function toggleProduct(pid) {
    setSelectedProducts(prev =>
      prev.includes(pid) ? prev.filter(p => p !== pid) : [...prev, pid]
    )
  }

  const [productSearch, setProductSearch] = useState('')

  const filteredProducts = products.filter(p => {
    if (!productSearch) return true
    const q = productSearch.toLowerCase()
    return p.description.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q) || p.ean.includes(q)
  })

  

  const titles = { new: 'Nuova rotazione', edit: 'Modifica rotazione', duplicate: 'Duplica rotazione' }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
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
          <div className="col-span-1">
            <label className="label">Cliente</label>
            <select
              className="input"
              value={form.customer_id}
              onChange={e => { setForm(f => ({ ...f, customer_id: e.target.value })); setSelectedProducts([]) }}
              disabled={mode === 'edit'}
            >
              <option value="">— Seleziona —</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
            {mode === 'edit' && <p className="text-xs text-gray-400 mt-1">Non modificabile.</p>}
          </div>
          <div>
            <label className="label">Punti vendita</label>
            <input
              type="number" min="1" step="1" className="input"
              placeholder="es. 100"
              value={form.num_points}
              onChange={e => setForm(f => ({ ...f, num_points: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Rotazione (pz/pdv)</label>
            <input
              type="number" min="0.1" step="0.1" className="input"
              placeholder="es. 2.5"
              value={form.rotation_value}
              onChange={e => setForm(f => ({ ...f, rotation_value: e.target.value }))}
            />
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
                <span className="ml-2 text-xs text-brand-600 font-normal">{selectedProducts.length} selezionati</span>
              )}
            </label>
            <div className="relative mb-1.5">
              <input
                type="text"
                className="input pl-8 text-xs"
                placeholder="Cerca prodotto, SKU, EAN…"
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
              />
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            </div>
            <div className="border border-gray-200 rounded-lg max-h-52 overflow-y-auto divide-y divide-gray-50">
              {filteredProducts.length === 0 ? (
                <p className="text-sm text-gray-400 px-3 py-4 text-center">Nessun prodotto trovato.</p>
              ) : filteredProducts.map(p => (
                <label
                  key={p.id}
                  className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                    p.inRotation && !selectedProducts.includes(p.id) ? 'bg-orange-50' : 'hover:bg-gray-50'
                  } ${selectedProducts.includes(p.id) ? 'bg-brand-50' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedProducts.includes(p.id)}
                    onChange={() => toggleProduct(p.id)}
                    className="rounded border-gray-300 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-900">{p.description}</span>
                    {p.sku && <span className="text-xs text-gray-400 ml-1.5">{p.sku}</span>}
                  </div>
                  {p.inRotation && !selectedProducts.includes(p.id) && (
                    <span className="text-xs bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded shrink-0">
                      {p.rotationPeriod}
                    </span>
                  )}
                </label>
              ))}
            </div>
            <div className="flex gap-2 mt-1.5">
              <button type="button" className="text-xs text-brand-600 hover:underline"
                onClick={() => setSelectedProducts(products.map(p => p.id))}>
                Seleziona tutti
              </button>
              <span className="text-gray-300">·</span>
              <button type="button" className="text-xs text-gray-400 hover:underline"
                onClick={() => setSelectedProducts([])}>
                Deseleziona tutti
              </button>
            </div>
          </div>
        )}

        {/* Note */}
        <div>
          <label className="label">Note (opzionale)</label>
          <input
            type="text" className="input"
            placeholder="es. Ordine estivo"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

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
  const [modal, setModal] = useState(null) // { mode: 'new'|'edit'|'duplicate', data: rotation|null }
  const [filterCustomer, setFilterCustomer] = useState('')

  const { data: rotations = [], isLoading } = useRotations()
  const { data: customers = [] }            = useCustomers()
  const createRotation = useCreateRotation()
  const updateRotation = useUpdateRotation()
  const deleteRotation = useDeleteRotation()

  const filtered = rotations.filter(r =>
    !filterCustomer || String(r.customer_id) === filterCustomer
  )

  async function handleSave({ id, rotation, productIds }) {
    if (id) {
      await updateRotation.mutateAsync({ id, rotation, productIds })
    } else {
      await createRotation.mutateAsync({ rotation, productIds })
    }
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
          <button className="btn-primary" onClick={() => setModal({ mode: 'new', data: null })}>
            <Plus size={16} /> Nuova rotazione
          </button>
        }
      />

      {/* Filtro cliente */}
      <div className="flex items-center gap-3 mb-4">
        <select
          className="input max-w-xs"
          value={filterCustomer}
          onChange={e => setFilterCustomer(e.target.value)}
        >
          <option value="">Tutti i clienti</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
        </select>
        {filterCustomer && (
          <button className="text-sm text-gray-400 hover:text-gray-600" onClick={() => setFilterCustomer('')}>
            Rimuovi filtro
          </button>
        )}
      </div>

      {/* Lista */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Caricamento…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 text-sm gap-2">
            <span>Nessuna rotazione trovata.</span>
            <button className="btn-primary mt-2" onClick={() => setModal({ mode: 'new', data: null })}>
              <Plus size={15} /> Crea la prima rotazione
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Cliente</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Periodo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Frequenza</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">PDV</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Rot.</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Pz/periodo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Prodotti</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((rotation, idx) => {
                const bg = idx % 2 === 1 ? '#f3f4f6' : '#ffffff'
                const previewMonths = calcMonths(rotation.period_start, rotation.period_end, rotation.frequency)
                return (
                  <tr key={rotation.id} style={{ backgroundColor: bg }}
                    onMouseEnter={e => Array.from(e.currentTarget.cells).forEach(td => td.style.backgroundColor = '#eeffee')}
                    onMouseLeave={e => Array.from(e.currentTarget.cells).forEach(td => td.style.backgroundColor = bg)}
                    className="transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{rotation.company_name}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {formatDate(rotation.period_start)} → {formatDate(rotation.period_end)}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {previewMonths.map(m => (
                          <span key={m} className="bg-brand-50 text-brand-700 text-xs px-1.5 py-0.5 rounded">{m}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{FREQUENCY_LABELS[rotation.frequency]}</td>
                    <td className="px-4 py-3 text-right text-gray-800">{rotation.num_points}</td>
                    <td className="px-4 py-3 text-right text-gray-800">{rotation.rotation_value}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {(rotation.num_points * rotation.rotation_value).toLocaleString('it-IT')}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      <span className="font-medium text-gray-800">{rotation.product_count}</span> prodotti
                      {rotation.notes && <div className="text-gray-400 mt-0.5 italic">{rotation.notes}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setModal({ mode: 'edit', data: rotation })}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                          title="Modifica"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setModal({ mode: 'duplicate', data: rotation })}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                          title="Duplica"
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(rotation)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Elimina"
                        >
                          <Trash2 size={14} />
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
        <p className="text-xs text-gray-400 mt-2 px-1">
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
