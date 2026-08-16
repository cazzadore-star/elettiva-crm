import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Zap } from 'lucide-react'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate   = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setLoading(true)
    const { error: err } = await login(email, password)
    setLoading(false)
    if (err) setError('Email o password non corretti.')
    else navigate('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--bg-page)' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ backgroundColor: 'var(--brand)' }}>
            <Zap size={24} className="text-white" />
          </div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text-main)' }}>Elettiva CRM</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-sub)' }}>Gestione Forecast Ordini</p>
        </div>

        {/* Card */}
        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="utente@elettiva.com" required autoFocus />
            </div>
            <div>
              <label className="label">Password</label>
              <input type="password" className="input" value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required />
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}
            <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
              {loading
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : 'Accedi'
              }
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--text-muted)' }}>
          Accesso riservato agli utenti autorizzati
        </p>
      </div>
    </div>
  )
}
