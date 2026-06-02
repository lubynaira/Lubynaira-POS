import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Menu, Clock, RotateCw, Settings as SettingsIcon, LogOut } from 'lucide-react'
import { useToast } from './Toast'

const PAGE_TITLES = {
  dashboard: { title: 'Dashboard', sub: 'Statistik & ringkasan toko' },
  kasir:     { title: 'Kasir',     sub: 'Transaksi POS realtime' },
  produk:    { title: 'Produk',    sub: 'Manajemen katalog produk' },
  order:     { title: 'Order',     sub: 'Daftar pesanan & invoice' },
  customers: { title: 'Customers', sub: 'Database pelanggan' },
  piutang:   { title: 'Piutang',   sub: 'Hutang & cicilan customer' },
}

export default function Header({
  activePage,
  onMenuToggle,
  currentUser,
  onOpenSettings,
  onLogout,
  onRefresh, // optional override; defaults to a no-op
}) {
  const meta = PAGE_TITLES[activePage] || PAGE_TITLES.dashboard
  const isOwner = currentUser?.role === 'owner'
  const [now, setNow] = useState(new Date())
  const [refreshing, setRefreshing] = useState(false)
  const toast = useToast()
  // Prevent overlapping refresh runs (e.g. user mashing F5)
  const inFlight = useRef(false)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  const initial = (currentUser?.username || 'A')[0].toUpperCase()

  // ---------- Refresh handler (button + F5 + Ctrl+R / Cmd+R) ----------
  const doRefresh = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    setRefreshing(true)
    const infoId = toast.info('Memperbarui data...', 0)
    try {
      if (typeof onRefresh === 'function') {
        await onRefresh()
      }
      toast.remove(infoId)
      toast.success('Data berhasil diperbarui')
    } catch (err) {
      toast.remove(infoId)
      // eslint-disable-next-line no-console
      console.error('[Header] refresh failed:', err)
      toast.error('Gagal memperbarui data')
    } finally {
      // Keep the spinner up for at least ~500ms so user sees motion
      setTimeout(() => setRefreshing(false), 450)
      inFlight.current = false
    }
  }, [onRefresh, toast])

  // Bind F5 + Ctrl+R / Cmd+R as soft-refresh.
  // We DON'T preventDefault inside form fields — typing should not be hijacked.
  useEffect(() => {
    const handler = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase()
      const isEditable = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable
      // F5 — always intercept (no modifier needed)
      const isF5 = e.key === 'F5'
      // Ctrl+R / Cmd+R
      const isCtrlR = (e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R')
      if (isF5 || isCtrlR) {
        // If user is editing, let F5/Ctrl+R fall through to the browser
        if (isEditable && !isF5) return
        e.preventDefault()
        doRefresh()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [doRefresh])

  return (
    <header
      className="flex items-center justify-between px-4 lg:px-6 py-3.5 flex-shrink-0"
      style={{
        background: 'rgba(17, 17, 24, 0.7)',
        backdropFilter: 'blur(16px) saturate(180%)',
        WebkitBackdropFilter: 'blur(16px) saturate(180%)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Left — menu + page title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuToggle}
          className="lg:hidden flex items-center justify-center rounded-xl flex-shrink-0"
          style={{
            width: 36, height: 36,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
          }}
        >
          <Menu size={17} />
        </button>
        <div className="min-w-0">
          <h1 className="font-bold text-base lg:text-lg leading-tight truncate"
            style={{ fontFamily: 'Syne', color: 'var(--text-primary)' }}>
            {meta.title}
          </h1>
          <p className="text-xs truncate hidden sm:block" style={{ color: 'var(--text-muted)' }}>
            {meta.sub}
          </p>
        </div>
      </div>

      {/* Right — [Refresh] [Clock] [Admin] */}
      <div className="flex items-center gap-2 flex-shrink-0">

        {/* Refresh button — premium neon purple */}
        <button
          onClick={doRefresh}
          disabled={refreshing}
          aria-label="Refresh Data"
          title="Refresh Data (F5)"
          className="relative flex items-center justify-center rounded-xl btn-press transition-all"
          style={{
            width: 36, height: 36, minWidth: 36,
            background: refreshing
              ? 'rgba(139,92,246,0.15)'
              : 'var(--bg-card)',
            border: `1px solid ${refreshing ? 'rgba(139,92,246,0.5)' : 'rgba(139,92,246,0.3)'}`,
            color: refreshing ? 'var(--accent-light)' : 'var(--text-secondary)',
            boxShadow: refreshing
              ? '0 0 16px rgba(139,92,246,0.45), inset 0 0 0 1px rgba(139,92,246,0.18)'
              : '0 0 0 rgba(139,92,246,0)',
            opacity: refreshing ? 0.95 : 1,
            cursor: refreshing ? 'progress' : 'pointer',
          }}
          onMouseEnter={(e) => {
            if (!refreshing) {
              e.currentTarget.style.boxShadow = '0 0 14px rgba(139,92,246,0.35)'
              e.currentTarget.style.borderColor = 'rgba(139,92,246,0.55)'
              e.currentTarget.style.color = 'var(--accent-light)'
            }
          }}
          onMouseLeave={(e) => {
            if (!refreshing) {
              e.currentTarget.style.boxShadow = '0 0 0 rgba(139,92,246,0)'
              e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)'
              e.currentTarget.style.color = 'var(--text-secondary)'
            }
          }}
        >
          <RotateCw
            size={15}
            className={refreshing ? 'animate-spin' : ''}
            style={{ transformOrigin: 'center' }}
          />
        </button>

        {/* Clock — visible from `sm` upward so it appears on iPhone portrait too */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', height: 36 }}>
          <Clock size={13} style={{ color: 'var(--accent-light)' }} />
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>
            {now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="text-xs hidden md:inline" style={{ color: 'var(--text-muted)' }}>·</span>
          <span className="text-xs hidden md:inline" style={{ color: 'var(--text-muted)' }}>
            {now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
          </span>
        </div>

        {/* Admin chip — desktop (initial + name + role).
            Owner: klik buka Settings. Staff: klik = no-op (display only). */}
        <button
          onClick={isOwner ? onOpenSettings : undefined}
          className="hidden md:flex items-center gap-2 px-2 py-1 rounded-xl btn-press"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            height: 36,
            cursor: isOwner ? 'pointer' : 'default',
          }}
          title={isOwner ? 'Pengaturan' : `${currentUser?.role || 'staff'}`}
        >
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
            style={{
              background: isOwner
                ? 'linear-gradient(135deg, #f59e0b, #ea580c)'
                : 'linear-gradient(135deg, #8b5cf6, #6366f1)',
              color: '#fff', fontFamily: 'Syne',
            }}>
            {initial}
          </div>
          <div className="hidden lg:block pr-1 text-left">
            <div className="text-xs font-semibold leading-tight"
              style={{ color: 'var(--text-primary)', fontFamily: 'Syne' }}>
              {currentUser?.name || currentUser?.username || 'Staff'}
            </div>
            <div className="text-xs leading-tight" style={{ color: 'var(--text-muted)' }}>
              {currentUser?.role || 'staff'}
            </div>
          </div>
        </button>

        {/* Logout button — selalu tampil untuk staff; owner punya via Settings/Sidebar */}
        {!isOwner && onLogout && (
          <button
            onClick={() => {
              if (window.confirm('Keluar dari aplikasi?')) onLogout()
            }}
            className="flex items-center justify-center rounded-xl"
            style={{
              width: 36, height: 36,
              background: 'var(--bg-card)',
              border: '1px solid rgba(255,77,106,0.3)',
              color: 'var(--red)',
            }}
            title="Logout"
            aria-label="Logout"
          >
            <LogOut size={15} />
          </button>
        )}

        {/* Settings gear (mobile) — owner ONLY */}
        {isOwner && (
          <button
            onClick={onOpenSettings}
            className="md:hidden flex items-center justify-center rounded-xl"
            style={{
              width: 36, height: 36,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
            }}
            title="Pengaturan"
          >
            <SettingsIcon size={15} />
          </button>
        )}
      </div>
    </header>
  )
}
