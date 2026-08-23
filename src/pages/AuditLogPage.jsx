import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useIsAdmin } from '../hooks/useUserRole'
import PageHeader from '../components/ui/PageHeader'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight, Circle } from 'lucide-react'

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

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1)  return 'adesso'
  if (min < 60) return `${min} min fa`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} or${h === 1 ? 'a' : 'e'} fa`
  const d = Math.floor(h / 24)
  return `${d} giorn${d === 1 ? 'o' : 'i'} fa`
}

function isRecentlyActive(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  return diffMs < 10 * 60 * 1000 // ultimi 10 minuti = "attivo"
}

function dayLabel(dateStr) {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  const sameDay = (a, b) => a.toDateString() === b.toDateString()
  if (sameDay(d, today)) return 'Oggi'
  if (sameDay(d, yesterday)) return 'Ieri'
  return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export default function AuditLogPage() {
  const isAdmin  = useIsAdmin()
  const navigate = useNavigate()
  const [filterTable, setFilterTable]   = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterUser, setFilterUser]     = useState('')
  const [filterFrom, setFilterFrom]     = useState('')
  const [filterTo, setFilterTo]         = useState('')
  const [page, setPage]                 = useState(0)
  const [collapsedDays, setCollapsedDays] = useState({})
  const [initialized, setInitialized]   = useState(false)
  const [expandedRow, setExpandedRow]   = useState(null)
  const PAGE_SIZE = 200

  // Ultima attività per utente (per il pannello "chi è attivo")
  const { data: lastActivity = [] } = useQuery({
    queryKey: ['audit_log', 'last_activity'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('user_email, created_at')
        .order('created_at', { ascending: false })
        .limit(500)
      if (error) throw error
      const map = {}
      for (const row of data) {
        if (row.user_email && !map[row.user_email]) map[row.user_email] = row.created_at
      }
      return Object.entries(map)
        .map(([email, created_at]) => ({ email, created_at }))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    },
    enabled: isAdmin,
    refetchInterval: 30000,
  })

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit_log', filterTable, filterAction, filterUser, filterFrom, filterTo, page],
    queryFn: async () => {
      let q = supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      if (filterTable)  q = q.eq('table_name', filterTable)
      if (filterAction) q = q.eq('action', filterAction)
      if (filterUser)   q = q.ilike('user_email', `%${filterUser}%`)
      if (filterFrom)   q = q.gte('created_at', `${filterFrom}T00:00:00`)
      if (filterTo)     q = q.lte('created_at', `${filterTo}T23:59:59`)
      const { data, error } = await q
      if (error) throw error
      return data
    },
    enabled: isAdmin,
  })

  // Raggruppa per giorno
  const groupedByDay = useMemo(() => {
    const groups = {}
    for (const log of logs) {
      const dayKey = new Date(log.created_at).toDateString()
      if (!groups[dayKey]) groups[dayKey] = []
      groups[dayKey].push(log)
    }
    return Object.entries(groups)
  }, [logs])

  // Tutti i giorni chiusi di default al primo caricamento
  useEffect(() => {
    if (!initialized && groupedByDay.length > 0) {
      const collapsed = {}
      groupedByDay.forEach(([dayKey]) => { collapsed[dayKey] = true })
      setCollapsedDays(collapsed)
      setInitialized(true)
    }
  }, [groupedByDay, initialized])

  function toggleDay(dayKey) {
    setCollapsedDays(prev => ({ ...prev, [dayKey]: !prev[dayKey] }))
  }

  if (isAdmin === false) {
    navigate('/dashboard')
    return null
  }

  const hasFilters = filterTable || filterAction || filterUser || filterFrom || filterTo

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader title="Log operazioni" description="Storico completo di tutte le modifiche al sistema" />

      {/* Pannello utenti attivi */}
      <div className="card p-4 mb-5">
        <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--text-main)' }}>Attività utenti</h2>
        {lastActivity.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nessuna attività registrata.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {lastActivity.map(u => {
              const active = isRecentlyActive(u.created_at)
              return (
                <div key={u.email} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--alt-row)' }}>
                  <Circle size={8} className={active ? 'fill-green-500 text-green-500' : 'fill-gray-300 text-gray-300'} />
                  <div>
                    <p className="text-xs font-medium" style={{ color: 'var(--text-main)' }}>{u.email}</p>
                    <p className="text-xs" style={{ color: active ? '#16a34a' : 'var(--text-muted)' }}>
                      {active ? 'Attivo ora' : `Ultima attività: ${timeAgo(u.created_at)}`}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

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
        <div className="flex items-center gap-1.5">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Dal</span>
          <input type="date" className="input text-sm" style={{ width: 'auto' }} value={filterFrom} onChange={e => { setFilterFrom(e.target.value); setPage(0) }} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>al</span>
          <input type="date" className="input text-sm" style={{ width: 'auto' }} value={filterTo} onChange={e => { setFilterTo(e.target.value); setPage(0) }} />
        </div>
        {hasFilters && (
          <button className="text-sm hover:underline" style={{ color: 'var(--text-muted)' }}
            onClick={() => { setFilterTable(''); setFilterAction(''); setFilterUser(''); setFilterFrom(''); setFilterTo(''); setPage(0) }}>
            Pulisci
          </button>
        )}
      </div>

      {/* Log raggruppato per giorno */}
      {isLoading ? (
        <div className="card flex items-center justify-center py-16 text-sm" style={{ color: 'var(--text-muted)' }}>Caricamento…</div>
      ) : groupedByDay.length === 0 ? (
        <div className="card flex items-center justify-center py-16 text-sm" style={{ color: 'var(--text-muted)' }}>Nessuna operazione trovata.</div>
      ) : (
        <div className="space-y-3">
          {groupedByDay.map(([dayKey, dayLogs]) => {
            const collapsed = collapsedDays[dayKey]
            return (
              <div key={dayKey} className="card overflow-hidden">
                <button
                  onClick={() => toggleDay(dayKey)}
                  className="w-full flex items-center justify-between px-4 py-3 transition-colors"
                  style={{ backgroundColor: 'var(--alt-row)' }}
                >
                  <div className="flex items-center gap-2">
                    {collapsed ? <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
                    <span className="text-sm font-medium capitalize" style={{ color: 'var(--text-main)' }}>{dayLabel(dayLogs[0].created_at)}</span>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{dayLogs.length} operazion{dayLogs.length === 1 ? 'e' : 'i'}</span>
                </button>

                {!collapsed && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                        <th className="text-left px-4 py-2 font-medium text-xs" style={{ color: 'var(--text-sub)' }}>Ora</th>
                        <th className="text-left px-4 py-2 font-medium text-xs" style={{ color: 'var(--text-sub)' }}>Utente</th>
                        <th className="text-left px-4 py-2 font-medium text-xs" style={{ color: 'var(--text-sub)' }}>Azione</th>
                        <th className="text-left px-4 py-2 font-medium text-xs" style={{ color: 'var(--text-sub)' }}>Sezione</th>
                        <th className="text-left px-4 py-2 font-medium text-xs" style={{ color: 'var(--text-sub)' }}>Dettaglio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayLogs.map((log, idx) => {
                        const bg = idx % 2 === 1 ? 'var(--alt-row)' : 'var(--bg-card)'
                        const action = ACTION_LABELS[log.action] || { label: log.action, color: 'bg-gray-100 text-gray-700' }
                        const isExpanded = expandedRow === log.id
                        return (
                          <>
                            <tr key={log.id} style={{ backgroundColor: bg, borderBottom: `1px solid var(--border)`, cursor: 'pointer' }}
                              onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                              onMouseEnter={e => Array.from(e.currentTarget.cells).forEach(td => td.style.backgroundColor = 'var(--hover-row)')}
                              onMouseLeave={e => Array.from(e.currentTarget.cells).forEach(td => td.style.backgroundColor = bg)}>
                              <td className="px-4 py-2 text-xs font-mono whitespace-nowrap" style={{ color: 'var(--text-sub)' }}>
                                {new Date(log.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </td>
                              <td className="px-4 py-2 text-xs" style={{ color: 'var(--text-main)' }}>{log.user_email || '—'}</td>
                              <td className="px-4 py-2">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${action.color}`}>{action.label}</span>
                              </td>
                              <td className="px-4 py-2 text-xs" style={{ color: 'var(--text-sub)' }}>{TABLE_LABELS[log.table_name] || log.table_name}</td>
                              <td className="px-4 py-2 text-xs" style={{ color: 'var(--text-main)' }}>{formatDetail(log)}</td>
                            </tr>
                            {isExpanded && (
                              <tr style={{ backgroundColor: bg }}>
                                <td colSpan={5} className="px-4 pb-3">
                                  <div className="rounded-lg p-3 text-xs font-mono grid grid-cols-2 gap-3" style={{ backgroundColor: 'var(--bg-page)', border: `1px solid var(--border)` }}>
                                    <div>
                                      <p className="mb-1 font-semibold" style={{ color: 'var(--text-muted)' }}>Prima</p>
                                      <pre className="whitespace-pre-wrap break-all" style={{ color: 'var(--text-sub)' }}>{log.old_data ? JSON.stringify(log.old_data, null, 2) : '—'}</pre>
                                    </div>
                                    <div>
                                      <p className="mb-1 font-semibold" style={{ color: 'var(--text-muted)' }}>Dopo</p>
                                      <pre className="whitespace-pre-wrap break-all" style={{ color: 'var(--text-sub)' }}>{log.new_data ? JSON.stringify(log.new_data, null, 2) : '—'}</pre>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Paginazione */}
      <div className="flex items-center justify-between mt-4 px-1">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Pagina {page + 1} · fino a {PAGE_SIZE} operazioni per pagina
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
