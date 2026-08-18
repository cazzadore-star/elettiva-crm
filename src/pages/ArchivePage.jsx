import { useState } from 'react'
import { Archive, Download, Trash2, Eye, X } from 'lucide-react'
import { useArchives, useDeleteArchive, useArchiveDetail } from '../hooks/useArchive'
import PageHeader from '../components/ui/PageHeader'

const MONTH_KEYS   = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
const MONTHS_IT    = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']
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
  const headers = ['EAN','Descrizione','Ragione Sociale','Listino Medio',...MONTHS_IT,'Totale Pezzi','Totale Valore']
  const data = rows.map(r => [r.ean, r.product_description, r.company_name, Number(r.avg_price_snapshot || 0), ...MONTH_KEYS.map(mk => Number(r[mk] || 0)), Number(r.total_qty || 0), Number(r.total_revenue || 0)])
  const totals = ['','','TOTALE','', ...MONTH_KEYS.map(mk => rows.reduce((s, r) => s + Number(r[mk] || 0), 0)), rows.reduce((s, r) => s + Number(r.total_qty || 0), 0), rows.reduce((s, r) => s + Number(r.total_revenue || 0), 0)]
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data, totals])
  ws['!cols'] = [{ wch:16 },{ wch:30 },{ wch:28 },{ wch:12 },...MONTHS_IT.map(()=>({ wch:10 })),{ wch:12 },{ wch:14 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, `Forecast ${archive.name}`)
  XLSX.writeFile(wb, `archivio_${archive.id}.xlsx`)
}

// ── Modal anteprima ──────────────────────────────────────────
function ArchivePreviewModal({ archiveId, onClose }) {
  const { data: archive, isLoading } = useArchiveDetail(archiveId)
  const [exporting, setExporting]    = useState(false)

  const rows   = archive?.data || []
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
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative rounded-xl shadow-xl w-full max-w-7xl max-h-[90vh] flex flex-col" style={{ backgroundColor: 'var(--bg-card)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h2 className="font-semibold" style={{ color: 'var(--text-main)' }}>{archive?.name}</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {rows.length} righe · archiviato il{' '}
              {archive && new Date(archive.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleExport} disabled={exporting || isLoading} className="btn-primary text-sm">
              {exporting ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Download size={14} /> Esporta Excel</>}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--alt-row)' }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}>
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="overflow-auto flex-1 p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-sm" style={{ color: 'var(--text-muted)' }}>Caricamento…</div>
          ) : (
            <table className="w-full text-xs" style={{ minWidth: '1200px' }}>
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--alt-row)' }}>
                  <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-sub)' }}>Cliente</th>
                  <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-sub)' }}>Prodotto</th>
                  <th className="text-right px-2 py-2 font-medium" style={{ color: 'var(--text-sub)' }}>€/pz</th>
                  {MONTHS_SHORT.map(m => <th key={m} className="text-right px-2 py-2 font-medium" style={{ color: 'var(--text-sub)' }}>{m}</th>)}
                  <th className="text-right px-3 py-2 font-medium" style={{ color: 'var(--text-sub)' }}>Tot. pz</th>
                  <th className="text-right px-3 py-2 font-medium" style={{ color: 'var(--text-sub)' }}>Tot. €</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const bg = idx % 2 === 1 ? 'var(--alt-row)' : 'var(--bg-card)'
                  return (
                    <tr key={idx} style={{ backgroundColor: bg, borderBottom: `1px solid var(--border)` }}>
                      <td className="px-3 py-1.5" style={{ color: 'var(--text-main)' }}>{row.company_name}</td>
                      <td className="px-3 py-1.5" style={{ color: 'var(--text-sub)' }}>{row.product_description}</td>
                      <td className="px-3 py-1.5 text-right" style={{ color: 'var(--text-muted)' }}>{Number(row.avg_price_snapshot || 0).toFixed(2)}</td>
                      {MONTH_KEYS.map(mk => <td key={mk} className="px-2 py-1.5 text-right" style={{ color: 'var(--text-main)' }}>{fmt(row[mk])}</td>)}
                      <td className="px-3 py-1.5 text-right font-medium" style={{ color: 'var(--text-main)' }}>{fmt(row.total_qty)}</td>
                      <td className="px-3 py-1.5 text-right font-medium" style={{ color: 'var(--text-main)' }}>{fmtEur(row.total_revenue)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-semibold" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--alt-row)' }}>
                  <td className="px-3 py-2" colSpan={3} style={{ color: 'var(--text-sub)' }}>Totale</td>
                  {MONTH_KEYS.map(mk => <td key={mk} className="px-2 py-2 text-right" style={{ color: 'var(--text-main)' }}>{fmt(totals[mk])}</td>)}
                  <td className="px-3 py-2 text-right" style={{ color: 'var(--text-main)' }}>{fmt(totals.total_qty)}</td>
                  <td className="px-3 py-2 text-right" style={{ color: 'var(--text-main)' }}>{fmtEur(totals.total_revenue)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Pagina principale ────────────────────────────────────────
export default function ArchivePage() {
  const [previewArchiveId, setPreviewArchiveId] = useState(null)

  const { data: archives = [], isLoading } = useArchives()
  const deleteArchive = useDeleteArchive()

  async function handleDelete(archive) {
    if (!confirm(`Eliminare l'archivio "${archive.name}"?\nL'operazione è irreversibile.`)) return
    await deleteArchive.mutateAsync(archive.id)
  }

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Archivio Forecast"
        description="Snapshot storici del forecast — sola lettura. Per creare un nuovo archivio, usa il pulsante 'Archivia' nella pagina Forecast."
      />

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-sm" style={{ color: 'var(--text-muted)' }}>Caricamento…</div>
        ) : archives.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-sm gap-2" style={{ color: 'var(--text-muted)' }}>
            <Archive size={32} style={{ color: 'var(--border)' }} />
            <span>Nessun archivio creato.</span>
            <p className="text-xs max-w-xs text-center" style={{ color: 'var(--text-muted)' }}>
              Vai nella pagina Forecast e usa il pulsante "Archivia" per salvare una fotografia dei dati filtrati.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--alt-row)' }}>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-sub)' }}>Nome</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-sub)' }}>Periodo</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-sub)' }}>Data archiviazione</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {archives.map((archive, idx) => {
                const bg = idx % 2 === 1 ? 'var(--alt-row)' : 'var(--bg-card)'
                return (
                  <tr key={archive.id} style={{ backgroundColor: bg, borderBottom: `1px solid var(--border)` }}
                    onMouseEnter={e => Array.from(e.currentTarget.cells).forEach(td => td.style.backgroundColor = 'var(--hover-row)')}
                    onMouseLeave={e => Array.from(e.currentTarget.cells).forEach(td => td.style.backgroundColor = bg)}>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-main)' }}>{archive.name}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-sub)' }}>
                      {archive.period_start && new Date(archive.period_start).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
                      {archive.period_end && <> → {new Date(archive.period_end).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</>}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-sub)' }}>
                      {new Date(archive.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setPreviewArchiveId(archive.id)}
                          className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={e => { e.currentTarget.style.color = 'var(--brand)'; e.currentTarget.style.backgroundColor = 'var(--brand-50)' }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent' }}
                          title="Visualizza"><Eye size={15} /></button>
                        <button onClick={() => handleDelete(archive)}
                          className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.backgroundColor = '#fee2e2' }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent' }}
                          title="Elimina"><Trash2 size={15} /></button>
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
        <p className="text-xs mt-2 px-1" style={{ color: 'var(--text-muted)' }}>
          {archives.length} archiv{archives.length === 1 ? 'io' : 'i'}
        </p>
      )}

      {previewArchiveId && (
        <ArchivePreviewModal archiveId={previewArchiveId} onClose={() => setPreviewArchiveId(null)} />
      )}
    </div>
  )
}
