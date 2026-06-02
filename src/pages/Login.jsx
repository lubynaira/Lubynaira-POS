import React, { useState } from 'react'
import { LogIn, User, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react'
import Logo from '../components/Logo'

export default function Login({ login, storeInfo, busy }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading || busy) return
    setError('')
    setLoading(true)
    try {
      const res = await login(username, password)
      if (!res.ok) setError(res.error || 'Login gagal')
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-screen flex items-center justify-center p-4 mesh-bg overflow-hidden relative">
      {/* Decorative glows */}
      <div
        className="absolute -top-32 -left-32 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.18), transparent 70%)', filter: 'blur(40px)' }}
      />
      <div
        className="absolute -bottom-40 -right-32 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,45,190,0.14), transparent 70%)', filter: 'blur(40px)' }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(6,214,245,0.08), transparent 70%)', filter: 'blur(60px)' }}
      />

      <div className="relative w-full max-w-md animate-scaleIn">
        <div
          className="rounded-3xl p-7 sm:p-9"
          style={{
            background: 'rgba(28,28,40,0.85)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            border: '1px solid var(--border-strong)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(139,92,246,0.08)',
          }}
        >
          {/* Logo */}
          <div className="flex flex-col items-center mb-6">
            <Logo size={72} customSrc={storeInfo?.frontLogo} />
            <h1
              className="font-bold text-2xl mt-4 text-center"
              style={{ fontFamily: 'Syne', color: 'var(--text-primary)' }}
            >
              {storeInfo?.name || 'Luby Naira POS'}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              {storeInfo?.tagline || 'Selamat datang kembali'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5"
                style={{ color: 'var(--text-secondary)', fontFamily: 'Syne', letterSpacing: '0.04em' }}>
                USERNAME
              </label>
              <div className="relative">
                <User size={14}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  autoFocus
                  className="w-full pl-10 pr-3 py-3 rounded-xl text-sm transition-all"
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5"
                style={{ color: 'var(--text-secondary)', fontFamily: 'Syne', letterSpacing: '0.04em' }}>
                PASSWORD
              </label>
              <div className="relative">
                <Lock size={14}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }} />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  className="w-full pl-10 pr-10 py-3 rounded-xl text-sm transition-all"
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {error && (
              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold animate-fadeIn"
                style={{
                  background: 'rgba(255,77,106,0.08)',
                  color: 'var(--red)',
                  border: '1px solid rgba(255,77,106,0.25)',
                }}
              >
                <AlertCircle size={13} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold btn-press disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              style={{
                background: 'linear-gradient(135deg, var(--accent), #6366f1)',
                color: '#fff',
                boxShadow: '0 6px 20px rgba(139,92,246,0.4)',
                fontFamily: 'Syne',
                letterSpacing: '0.04em',
              }}
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  MEMPROSES...
                </>
              ) : (
                <>
                  <LogIn size={15} />
                  MASUK
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-5 text-xs" style={{ color: 'var(--text-muted)' }}>
          © {new Date().getFullYear()} {storeInfo?.name || 'Luby Naira POS'} · All rights reserved
        </div>
      </div>
    </div>
  )
}
