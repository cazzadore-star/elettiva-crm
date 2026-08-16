import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useIsAdmin } from '../hooks/useUserRole'
import PageHeader from '../components/ui/PageHeader'
import { useNavigate } from 'react-router-dom'

const TABLE_LABELS = {
  forecast_lines:     'Forecast — quantità',
  forecast_headers:   'Forecast — righe',
  rotations:          'Rotazioni',
  rotation_products:  'Rotazioni — prodotti',
  price_lists:        'Listini medi',
  products:           'Prodotti',
  customers:          'Clienti',
  report_lines:       'Report',
}

const ACTION_LABELS = {
  INSERT: { label: 'Inserimento', color: 'bg-green-100 text-green-700' },
  UPDATE: { label: 'Modifica',    color: 'bg-blue-100 text-blue-700' },
  DELETE: { label: 'Eliminazione', color: 'bg-red-100 text-red-700' },
}

function formatDetail(row) {
  const data = row.action === 'DELETE' ? row.old_data : row.new_data
  if (!data) return '—'

  if (row.table_name === 'forecast_lines') {
    const months = ['gen','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
    const m = months[data.month - 1] || data.month
    const old_qty = row.old_data?.qty_pieces ?? '—'
    const new_qty = row.new_data?.qty_pieces ?? '—'
    if (row.action === 'UPDATE') return `Mese: ${m.toUpperCase()} → ${old_qty} pz → ${new_qty} pz`
    return `Mese: ${m.toUpperCase()}, Qty: ${data.qty_pieces}`
  }
  if (row.table_name === 'products') return data.description || data.ean || data.id
  if (row.table_name === 'customers') return data.company_name || data.id
  if (row.table_name === 'price_lists') return `Listino: € ${data.avg_price}`
  if (row.table_name === 'rotations') return `Cliente ID: ${data.customer_id}, ${data.num_points} PDV × ${data.rotation_value}`
  return `ID: ${row.record_id}`
}

export default function AuditLogPage() {
  const isAdmin = useIsAdmin()
  const navigate = useNavigate()
  const [filterTable, setFilterTable]   = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterUser, setFilterUser]     = useState('')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit_log', filterTable, filterAction, filterUser, page],
    queryFn: async () => {
      let q = supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      if (filterTable)  q = q.eq('table_name', filterTable)
      if (filterAction) q = q.eq('action', filterAction)
      if (filterUser)   q = q.ilike('user_email', `%${filterUser}%`)
      const { data, error } = await q
      if (error) throw error
      return data
    },
    enabled: isAdmin,
  })

  // Redirect se non admin
  if (isAdmin === false) {
    navigate('/dashboard')
    return null
  }

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader title="Log operazioni" description="Storico completo di tutte le modifiche al sistema" />

      {/* Filtri */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select className="input text-sm" style={{ width: 'auto', minWidth: '160px' }} value={filterTable} onChange={e => { setFilterTable(e.target.value); setPage(0) }}>
          <option value="">Tutte le tabelle</option>
          {Object.entries(TABLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input text-sm" style={{ width: 'auto', minWidth: '130px' }} value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(0) }}>
          <option value="">Tutte le azioni</option>
          <option value="INSERT">Inserimento</option>
          <option value="UPDATE">Modifica</option>
          <option value="DELETE">Eliminazione</option>
        </select>
        <input className="input text-sm" style={{ width: '180px' }} placeholder="Filtra per utente…"
          value={filterUser} onChange={e => { setFilterUser(e.target.value); setPage(0) }} />
        {(filterTable || filterAction || filterUser) && (
          <button className="text-sm hover:underline" style={{ color: 'var(--text-muted)' }}
            onClick={() => { setFilterTable(''); setFilterAction(''); setFilterUser(''); setPage(0) }}>
            Pulisci
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-sm" style={{ color: 'var(--text-muted)' }}>Caricamento…</div>
        ) : logs.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm" style={{ color: 'var(--text-muted)' }}>Nessuna operazione trovata.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--alt-row)' }}>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-sub)' }}>Data e ora</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-sub)' }}>Utente</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-sub)' }}>Azione</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-sub)' }}>Sezione</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-sub)' }}>Dettaglio</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, idx) => {
                const bg = idx % 2 === 1 ? 'var(--alt-row)' : 'var(--bg-card)'
                const action = ACTION_LABELS[log.action] || { label: log.action, color: 'bg-gray-100 text-gray-700' }
                return (
                  <tr key={log.id} style={{ backgroundColor: bg, borderBottom: `1px solid var(--border)` }}
                    onMouseEnter={e => Array.from(e.currentTarget.cells).forEach(td => td.style.backgroundColor = 'var(--hover-row)')}
                    onMouseLeave={e => Array.from(e.currentTarget.cells).forEach(td => td.style.backgroundColor = bg)}>
                    <td className="px-4 py-2 text-xs font-mono whitespace-nowrap" style={{ color: 'var(--text-sub)' }}>
                      {new Date(log.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="px-4 py-2 text-xs" style={{ color: 'var(--text-main)' }}>{log.user_email || '—'}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${action.color}`}>{action.label}</span>
                    </td>
                    <td className="px-4 py-2 text-xs" style={{ color: 'var(--text-sub)' }}>{TABLE_LABELS[log.table_name] || log.table_name}</td>
                    <td className="px-4 py-2 text-xs" style={{ color: 'var(--text-main)' }}>{formatDetail(log)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginazione */}
      <div className="flex items-center justify-between mt-3 px-1">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Pagina {page + 1} · {PAGE_SIZE} operazioni per pagina
        </p>
        <div className="flex gap-2">
          <button className="btn-secondary text-xs px-3 py-1.5" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
            ← Precedente
          </button>
          <button className="btn-secondary text-xs px-3 py-1.5" onClick={() => setPage(p => p + 1)} disabled={logs.length < PAGE_SIZE}>
            Successiva →
          </button>
        </div>
      </div>
    </div>
  )
}
