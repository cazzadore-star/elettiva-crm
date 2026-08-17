import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useTheme } from '../hooks/useTheme'
import { useIsAdmin } from '../hooks/useUserRole'
import {
  LayoutDashboard, Package, Users, Tag,
  BarChart2, FileText, LogOut, Zap,
  RefreshCw, Archive, Settings, Sun, Moon, ClipboardList
} from 'lucide-react'

export default function Layout() {
  const { user, logout }       = useAuth()
  const { theme, toggleTheme } = useTheme()
  const isAdmin                = useIsAdmin()
  const navigate               = useNavigate()

  const NAV = [
    { to: '/dashboard',  label: 'Dashboard',    icon: LayoutDashboard },
    { to: '/products',   label: 'Prodotti',      icon: Package },
    { to: '/customers',  label: 'Clienti',       icon: Users },
    { to: '/pricelists', label: 'Listini medi',  icon: Tag },
    { to: '/rotations',  label: 'Rotazioni',     icon: RefreshCw },
    { to: '/forecast',   label: 'Forecast',      icon: BarChart2 },
    { to: '/report',     label: 'Report',        icon: FileText },
    { to: '/archive',    label: 'Archivio',      icon: Archive },
    { to: '/settings',   label: 'Impostazioni',  icon: Settings },
    ...(isAdmin ? [{ to: '/auditlog', label: 'Log operazioni', icon: ClipboardList }] : []),
  ]

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg-page)' }}>
      {/* Sidebar */}
      <aside className="w-56 flex flex-col shrink-0 border-r" style={{ backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--border)' }}>
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="w-7 h-7 bg-brand-600 rounded-lg flex items-center justify-center">
            <Zap size={15} className="text-white" />
          </div>
          <span className="font-semibold text-sm" style={{ color: 'var(--text-main)' }}>Elettiva CRM</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ` +
                (isActive ? 'bg-brand-50 text-brand-700 font-medium' : '')
              }
              style={({ isActive }) => isActive ? {} : { color: 'var(--text-sub)' }}
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom: theme toggle + user + logout */}
        <div className="border-t px-3 py-3 space-y-1" style={{ borderColor: 'var(--border)' }}>
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors"
            style={{ color: 'var(--text-sub)' }}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            {theme === 'dark' ? 'Tema chiaro' : 'Tema scuro'}
          </button>

         <p className="text-xs truncate px-1" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
         <p className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>v1.4.2</p>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors"
            style={{ color: 'var(--text-sub)' }}
          >
            <LogOut size={15} />
            Esci
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
