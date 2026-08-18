import { useState, useEffect } from 'react'
import { Save } from 'lucide-react'
import { useSettings, useUpdateSettings } from '../hooks/useSettings'
import { useCategories, useToggleCategoryReportExclusion } from '../hooks/useCategories'
import PageHeader from '../components/ui/PageHeader'

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings()
  const update = useUpdateSettings()

  const { data: categories = [] } = useCategories()
  const toggleExclusion = useToggleCategoryReportExclusion()

  const [form, setForm] = useState({ period_start: '', period_end: '', default_rotation: '' })
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (settings) {
      setForm({ period_start: settings.period_start, period_end: settings.period_end, default_rotation: settings.default_rotation })
    }
  }, [settings])

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setSaved(false)
    if (!form.period_start) return setError('Inserisci la data di inizio periodo.')
    if (!form.period_end)   return setError('Inserisci la data di fine periodo.')
    if (form.period_end <= form.period_start) return setError('La data di fine deve essere successiva alla data di inizio.')
    if (!form.default_rotation || Number(form.default_rotation) <= 0) return setError('Inserisci un valore di rotazione valido (> 0).')
    try {
      await update.mutateAsync({ period_start: form.period_start, period_end: form.period_end, default_rotation: Number(form.default_rotation) })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Errore nel salvataggio. Riprova.')
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-16 text-sm" style={{ color: 'var(--text-muted)' }}>Caricamento…</div>
  }

  return (
    <div className="max-w-lg mx-auto">
      <PageHeader title="Impostazioni" description="Configurazione globale del sistema" />

      <div className="card p-6 mb-4">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Periodo */}
          <div>
            <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-main)' }}>Periodo di riferimento</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Data inizio</label>
                <input type="date" className="input" value={form.period_start}
                  onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))} />
              </div>
              <div>
                <label className="label">Data fine</label>
                <input type="date" className="input" value={form.period_end}
                  onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))} />
              </div>
            </div>
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
              Definisce il periodo usato nelle rotazioni come default.
            </p>
          </div>

          {/* Rotazione default */}
          <div>
            <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-main)' }}>Rotazione default</h2>
            <div className="flex items-center gap-3">
              <input type="number" step="0.1" min="0.1" className="input max-w-36"
                value={form.default_rotation}
                onChange={e => setForm(f => ({ ...f, default_rotation: e.target.value }))} />
              <span className="text-sm" style={{ color: 'var(--text-sub)' }}>pezzi per punto vendita per periodo</span>
            </div>
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
              Valore preimpostato quando si crea una nuova rotazione.
            </p>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          {saved  && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">✓ Impostazioni salvate correttamente.</p>}

          <div className="pt-2">
            <button type="submit" className="btn-primary" disabled={update.isPending}>
              {update.isPending
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <><Save size={15} /> Salva impostazioni</>
              }
            </button>
          </div>
        </form>
      </div>

      {/* Riepilogo periodo corrente */}
      {settings && (
        <div className="mb-6 px-4 py-3 rounded-lg text-sm border" style={{ backgroundColor: 'var(--alt-row)', borderColor: 'var(--border)', color: 'var(--text-sub)' }}>
          <span className="font-medium" style={{ color: 'var(--text-main)' }}>Periodo attivo:</span>{' '}
          {new Date(settings.period_start).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
          {' → '}
          {new Date(settings.period_end).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
          {' · Rotazione default: '}
          <span className="font-medium" style={{ color: 'var(--text-main)' }}>{settings.default_rotation}</span>
        </div>
      )}

      {/* Categorie escluse dal Report */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-main)' }}>Categorie escluse dal Report</h2>
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
          Le categorie escluse non compaiono nel Report per default. Possono comunque essere visualizzate temporaneamente da un filtro nella pagina Report.
        </p>
        <div className="space-y-1">
          {categories.map(cat => (
            <label key={cat.id} className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors"
              style={{ backgroundColor: 'var(--alt-row)' }}>
              <span className="text-sm" style={{ color: 'var(--text-main)' }}>{cat.name}</span>
              <input
                type="checkbox"
                checked={!!cat.excluded_from_report}
                onChange={e => toggleExclusion.mutate({ id: cat.id, excluded_from_report: e.target.checked })}
                className="rounded"
              />
            </label>
          ))}
          {categories.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nessuna categoria disponibile.</p>
          )}
        </div>
      </div>
    </div>
  )
}
