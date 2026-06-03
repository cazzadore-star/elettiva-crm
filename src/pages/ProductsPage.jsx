import { useState } from 'react'
import { Plus, Search, Pencil, PowerOff, Power } from 'lucide-react'
import { useProducts, useUpsertProduct, useToggleProductActive } from '../hooks/useProducts'
import { useCategories, useAddCategory } from '../hooks/useCategories'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'

const EMPTY_FORM = { ean: '', sku: '', description: '', description_report: '', category_id: '' }

export default function ProductsPage() {
  const [search, setSearch]                 = useState('')
  const [showInactive, setShowInactive]     = useState(false)
  const [filterCategory, setFilterCategory] = useState('')
  const [modalOpen, setModalOpen]           = useState(false)
  const [form, setForm]                     = useState(EMPTY_FORM)
  const [formError, setFormError]           = useState('')
  const [newCatName, setNewCatName]         = useState('')
  const [addingCat, setAddingCat]           = useState(false)

  const { data: products = [], isLoading } = useProducts({ includeInactive: showInactive })
  const { data: categories = [] }          = useCategories()
  const upsert = useUpsertProduct()
  const toggle = useToggleProductActive()
  const addCat = useAddCategory()

  const filtered = products.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = p.description.toLowerCase().includes(q) || p.ean.includes(q) || (p.sku || '').toLowerCase().includes(q)
    const matchCat    = !filterCategory || String(p.category_id) === filterCategory
    return matchSearch && matchCat
  })

  function openNew() {
    setForm(EMPTY_FORM)
    setFormError('')
    setNewCatName('')
    setAddingCat(false)
    setModalOpen(true)
  }

  function openEdit(product) {
    setForm({
      id:                 product.id,
      ean:                product.ean,
      sku:                product.sku || '',
      description:        product.description,
      description_report: product.description_report || '',
      active:             product.active,
      category_id:        product.category_id ? String(product.category_id) : '',
    })
    setFormError('')
    setNewCatName('')
    setAddingCat(false)
    setModalOpen(true)
  }

  async function handleAddCategory() {
    if (!newCatName.trim()) return
    try {
      const cat = await addCat.mutateAsync(newCatName)
      setForm(f => ({ ...f, category_id: String(cat.id) }))
      setNewCatName('')
      setAddingCat(false)
    } catch {
      setFormError('Categoria già esistente o errore nel salvataggio.')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')
    if (!form.ean.trim())         return setFormError('EAN obbligatorio.')
    if (!form.description.trim()) return setFormError('Descrizione Forecast obbligatoria.')
    try {
      await upsert.mutateAsync({
        ...form,
        category_id: form.category_id ? Number(form.category_id) : null,
      })
      setModalOpen(false)
    } catch (err) {
      if (err.message?.includes('products_ean_unique')) {
        setFormError('Esiste già un prodotto con questo EAN.')
      } else {
        setFormError('Errore nel salvataggio. Riprova.')
      }
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Prodotti"
        description="Gestione anagrafica prodotti"
        action={
          <button className="btn-primary" onClick={openNew}>
            <Plus size={16} /> Nuovo prodotto
          </button>
        }
      />

      {/* Filtri */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Cerca per EAN, SKU o descrizione…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input max-w-48"
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
        >
          <option value="">Tutte le categorie</option>
          {categories.map(c => (
            <option key={c.id} value={String(c.id)}>{c.name}</option>
          ))}
        </select>
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
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Caricamento…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 text-sm gap-2">
            <span>Nessun prodotto trovato.</span>
            {!search && !filterCategory && (
              <button className="btn-primary mt-2" onClick={openNew}>
                <Plus size={15} /> Aggiungi il primo prodotto
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500">EAN</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">SKU</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Desc. Forecast</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Desc. Report</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Categoria</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Stato</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((product, idx) => (
                <tr key={product.id} className={`${idx % 2 === 0 ? 'table-row-even' : 'table-row-odd'} transition-colors`}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{product.ean}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{product.sku || <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-gray-900">{product.description}</td>
                  <td className="px-4 py-3 text-gray-600">{product.description_report || <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3">
                    {product.product_categories?.name
                      ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700">{product.product_categories.name}</span>
                      : <span className="text-gray-300 text-xs">—</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    {product.active
                      ? <span className="badge-active">Attivo</span>
                      : <span className="badge-inactive">Disattivato</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(product)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                        title="Modifica"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => toggle.mutateAsync({ id: product.id, active: !product.active })}
                        className={`p-1.5 rounded-lg transition-colors ${product.active ? 'text-gray-400 hover:text-red-600 hover:bg-red-50' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}
                        title={product.active ? 'Disattiva' : 'Riattiva'}
                      >
                        {product.active ? <PowerOff size={15} /> : <Power size={15} />}
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
          {filtered.length} prodott{filtered.length === 1 ? 'o' : 'i'}
        </p>
      )}

      {/* Modal */}
      {modalOpen && (
        <Modal
          title={form.id ? 'Modifica prodotto' : 'Nuovo prodotto'}
          onClose={() => setModalOpen(false)}
        >
          <form onSubmit={handleSubmit} className="space-y-4">

            <div className="grid grid-cols-2 gap-3">
              <div className="max-w-5xl mx-auto">
                <label className="label">EAN</label>
                <input
                  className="input"
                  placeholder="es. 8001234567890"
                  value={form.ean}
                  onChange={e => setForm(f => ({ ...f, ean: e.target.value.trim() }))}
                  autoFocus
                />
              </div>
              <div className="max-w-5xl mx-auto">
                <label className="label">SKU</label>
                <input
                  className="input"
                  placeholder="es. ALF-250"
                  value={form.sku}
                  onChange={e => setForm(f => ({ ...f, sku: e.target.value.trim() }))}
                />
              </div>
            </div>

            <div className="max-w-5xl mx-auto">
              <label className="label">Descrizione Forecast</label>
              <input
                className="input"
                placeholder="Descrizione usata nel Forecast"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="max-w-5xl mx-auto">
              <label className="label">Descrizione Report</label>
              <input
                className="input"
                placeholder="Descrizione usata nel Report (opzionale)"
                value={form.description_report}
                onChange={e => setForm(f => ({ ...f, description_report: e.target.value }))}
              />
              <p className="text-xs text-gray-400 mt-1">Se vuota, nel report verrà usata la Descrizione Forecast.</p>
            </div>

            {/* Categoria */}
            <div className="max-w-5xl mx-auto">
              <label className="label">Categoria</label>
              {!addingCat ? (
                <div className="flex gap-2">
                  <select
                    className="input flex-1"
                    value={form.category_id}
                    onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                  >
                    <option value="">— Nessuna categoria —</option>
                    {categories.map(c => (
                      <option key={c.id} value={String(c.id)}>{c.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-secondary shrink-0 text-xs px-3"
                    onClick={() => setAddingCat(true)}
                  >
                    <Plus size={13} /> Nuova
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    placeholder="Nome nuova categoria"
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory() } }}
                  />
                  <button type="button" className="btn-primary shrink-0 text-xs px-3" onClick={handleAddCategory} disabled={addCat.isPending}>
                    Aggiungi
                  </button>
                  <button type="button" className="btn-secondary shrink-0 text-xs px-3" onClick={() => { setAddingCat(false); setNewCatName('') }}>
                    Annulla
                  </button>
                </div>
              )}
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
                  : form.id ? 'Salva modifiche' : 'Crea prodotto'
                }
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
