import { useState } from 'react'
import { Archive, Download, Trash2, Plus, Eye, X } from 'lucide-react'
import { useArchives, useCreateArchive, useDeleteArchive, useArchiveDetail } from '../hooks/useArchive'
import PageHeader from '../components/ui/PageHeader'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 1 + i)
const MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
const MONTHS_IT  = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']
const MONTHS_SHORT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']

function fmt(n) {
  return Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function fmtEur(n) {
  return '€ ' + Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function exportArchiveToExcel(archive) {
  const XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/xlsx.mjs')
  const rows = archive.data

  const headers = [
    'EAN', 'Descrizione', 'Ragione Sociale', 'Listino Medio',
    ...MONTHS_IT, 'Totale Pezzi', 'Totale Valore'
  ]

  const data = rows.map(r => [
    r.ean,
    r.product_description,
    r.company_name,
    Number(r.avg_price_snapshot || 0),
    ...MONTH_KEYS.map(mk => Number(r[mk] || 0)),
    Number(r.total_qty || 0),
    Number(r.total_revenue || 0),
  ])

  const totals = [
    '', '', 'TOTALE', '',
    ...MONTH_KEYS.map(mk => rows.reduce((s, r) => s + Number(r[mk] || 0), 0)),
    rows.reduce((s, r) => s + Number(r.total_qty || 0), 0),
    rows.reduce((s, r) => s + Number(r.total_revenue || 0), 0),
  ]

  const wsData = [headers, ...data, totals]
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  ws['!cols'] = [
    { wch: 16 }, { wch: 30 }, { wch: 28 }, { wch: 12 },
    ...MONTHS_IT.map(() => ({ wch: 10 })),
    { wch: 12 }, { wch: 14 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, `Forecast ${archive.year}`)
  XLSX.writeFile(wb, `archivio_forecast_${archive.year}_${archive.id}.xlsx`)
}

// Modal anteprima archivio
function ArchivePreviewModal({ archiveId, onClose }) {
  const { data: archive, isLoading } = useArchiveDetail(archiveId)
  const [exporting, setExporting] = useState(false)

  const rows = archive?.data || []
  const totals = rows.reduce((acc, r) => {
    MONTH_KEYS.forEach(mk => { acc[mk] = (acc[mk] || 0) + Number(r[mk] || 0) })
    acc.total_qty     = (acc.total_qty     || 0) + Number(r.total_qty     || 0)
    acc.total_revenue = (acc.total_revenue || 0) + Number(r.total_revenue || 0)
    return acc
  }, {})

  async function handleExport() {
    setExporting(true)
    try { await exportArchiveToExcel(archive) }
    finally { setExporting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-7xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">{archive?.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Anno {archive?.year} · {rows.length} righe · archiviato il{' '}
              {archive && new Date(archive.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={exporting || isLoading}
              className="btn-primary text-sm"
            >
              {exporting
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <><Download size={14} /> Esporta Excel</>
              }
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tabella */}
        <div className="overflow-auto flex-1 p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Caricamento…</div>
          ) : (
            <table className="w-full text-xs" style={{ minWidth: '1200px' }}>
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-3 py-2 font-medium text-gray-500">Cliente</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-500">Prodotto</th>
                  <th className="text-right px-2 py-2 font-medium text-gray-500">€/pz</th>
                  {MONTHS_SHORT.map(m => <th key={m} className="text-right px-2 py-2 font-medium text-gray-500">{m}</th>)}
                  <th className="text-right px-3 py-2 font-medium text-gray-500">Tot. pz</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-500">Tot. €</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const bg = idx % 2 === 1 ? '#f3f4f6' : '#ffffff'
                  return (
                    <tr key={idx} style={{ backgroundColor: bg }} className="border-b border-gray-50">
                      <td className="px-3 py-1.5 text-gray-900">{row.company_name}</td>
                      <td className="px-3 py-1.5 text-gray-700">{row.product_description}</td>
                      <td className="px-3 py-1.5 text-right text-gray-500">{Number(row.avg_price_snapshot || 0).toFixed(2)}</td>
                      {MONTH_KEYS.map(mk => <td key={mk} className="px-2 py-1.5 text-right text-gray-800">{fmt(row[mk])}</td>)}
                      <td className="px-3 py-1.5 text-right font-medium">{fmt(row.total_qty)}</td>
                      <td className="px-3 py-1.5 text-right font-medium">{fmtEur(row.total_revenue)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-100 font-semibold">
                  <td className="px-3 py-2 text-gray-700" colSpan={3}>Totale</td>
                  {MONTH_KEYS.map(mk => <td key={mk} className="px-2 py-2 text-right">{fmt(totals[mk])}</td>)}
                  <td className="px-3 py-2 text-right">{fmt(totals.total_qty)}</td>
                  <td className="px-3 py-2 text-right">{fmtEur(totals.total_revenue)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// Modal nuova archiviazione
function NewArchiveModal({ onClose, onSave }) {
  const [name, setName]   = useState(`Archivio ${new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}`)
  const [year, setYear]   = useState(CURRENT_YEAR)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return setError('Inserisci un nome per l\'archivio.')
    setSaving(true)
    try {
      await onSave({ name: name.trim(), year })
      onClose()
    } catch {
      setError('Errore durante l\'archiviazione. Riprova.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Archivia Forecast</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label className="label">Anno forecast</label>
            <select className="input" value={year} onChange={e => setYear(Number(e.target.value))}>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Nome archivio</label>
            <input
              className="input"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-gray-400 mt-1">Usa un nome che ti aiuti a riconoscere il momento della snapshot.</p>
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>Annulla</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <><Archive size={14} /> Archivia ora</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ArchivePage() {
  const [newModalOpen, setNewModalOpen]       = useState(false)
  const [previewArchiveId, setPreviewArchiveId] = useState(null)

  const { data: archives = [], isLoading } = useArchives()
  const createArchive = useCreateArchive()
  const deleteArchive = useDeleteArchive()

  async function handleDelete(archive) {
    if (!confirm(`Eliminare l'archivio "${archive.name}"?\nL'operazione è irreversibile.`)) return
    await deleteArchive.mutateAsync(archive.id)
  }

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Archivio Forecast"
        description="Snapshot storici del forecast — sola lettura"
        action={
          <button className="btn-primary" onClick={() => setNewModalOpen(true)}>
            <Archive size={16} /> Archivia ora
          </button>
        }
      />

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Caricamento…</div>
        ) : archives.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 text-sm gap-2">
            <Archive size={32} className="text-gray-200" />
            <span>Nessun archivio creato.</span>
            <p className="text-xs text-gray-300 max-w-xs text-center">
              Archivia il forecast per salvare una fotografia dei dati in questo momento.
            </p>
            <button className="btn-primary mt-2" onClick={() => setNewModalOpen(true)}>
              <Archive size={15} /> Crea il primo archivio
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Nome</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Anno</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Data archiviazione</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {archives.map((archive, idx) => {
                const bg = idx % 2 === 1 ? '#f3f4f6' : '#ffffff'
                return (
                  <tr key={archive.id} style={{ backgroundColor: bg }}
                    onMouseEnter={e => Array.from(e.currentTarget.cells).forEach(td => td.style.backgroundColor = '#eeffee')}
                    onMouseLeave={e => Array.from(e.currentTarget.cells).forEach(td => td.style.backgroundColor = bg)}
                    className="transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{archive.name}</td>
                    <td className="px-4 py-3 text-gray-600">{archive.year}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(archive.created_at).toLocaleDateString('it-IT', {
                        day: 'numeric', month: 'long', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setPreviewArchiveId(archive.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                          title="Visualizza"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(archive)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Elimina"
                        >
                          <Trash2 size={15} />
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

      {archives.length > 0 && (
        <p className="text-xs text-gray-400 mt-2 px-1">
          {archives.length} archivi{archives.length === 1 ? 'o' : ''}
        </p>
      )}

      {newModalOpen && (
        <NewArchiveModal
          onClose={() => setNewModalOpen(false)}
          onSave={createArchive.mutateAsync}
        />
      )}

      {previewArchiveId && (
        <ArchivePreviewModal
          archiveId={previewArchiveId}
          onClose={() => setPreviewArchiveId(null)}
        />
      )}
    </div>
  )
}
