import { useState, useEffect } from 'react'
import { Save } from 'lucide-react'
import { useSettings, useUpdateSettings } from '../hooks/useSettings'
import PageHeader from '../components/ui/PageHeader'

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings()
  const update = useUpdateSettings()

  const [form, setForm] = useState({
    period_start:     '',
    period_end:       '',
    default_rotation: '',
  })
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // Popola il form quando i settings arrivano dal DB
  useEffect(() => {
    if (settings) {
      setForm({
        period_start:     settings.period_start,
        period_end:       settings.period_end,
        default_rotation: settings.default_rotation,
      })
    }
  }, [settings])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaved(false)

    if (!form.period_start) return setError('Inserisci la data di inizio periodo.')
    if (!form.period_end)   return setError('Inserisci la data di fine periodo.')
    if (form.period_end <= form.period_start) return setError('La data di fine deve essere successiva alla data di inizio.')
    if (!form.default_rotation || Number(form.default_rotation) <= 0) return setError('Inserisci un valore di rotazione valido (> 0).')

    try {
      await update.mutateAsync({
        period_start:     form.period_start,
        period_end:       form.period_end,
        default_rotation: Number(form.default_rotation),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Errore nel salvataggio. Riprova.')
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Caricamento…</div>
  }

  return (
    <div className="max-w-lg mx-auto">
      <PageHeader
        title="Impostazioni"
        description="Configurazione globale del sistema"
      />

      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Periodo */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Periodo di riferimento</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Data inizio</label>
                <input
                  type="date"
                  className="input"
                  value={form.period_start}
                  onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Data fine</label>
                <input
                  type="date"
                  className="input"
                  value={form.period_end}
                  onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))}
                />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              Definisce il periodo usato nelle rotazioni come default.
            </p>
          </div>

          {/* Rotazione default */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Rotazione default</h2>
            <div className="flex items-center gap-3">
              <input
                type="number"
                step="0.1"
                min="0.1"
                className="input max-w-36"
                value={form.default_rotation}
                onChange={e => setForm(f => ({ ...f, default_rotation: e.target.value }))}
              />
              <span className="text-sm text-gray-500">pezzi per punto vendita per periodo</span>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              Valore preimpostato quando si crea una nuova rotazione.
            </p>
          </div>

          {/* Feedback */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          {saved && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              ✓ Impostazioni salvate correttamente.
            </p>
          )}

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
        <div className="mt-4 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
          <span className="font-medium">Periodo attivo:</span>{' '}
          {new Date(settings.period_start).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
          {' → '}
          {new Date(settings.period_end).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
          {' · Rotazione default: '}
          <span className="font-medium">{settings.default_rotation}</span>
        </div>
      )}
    </div>
  )
}
