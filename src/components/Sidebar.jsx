import React from 'react'
import {
  LayoutDashboard, ShoppingCart, Package, ClipboardList,
  ChevronRight, X, Settings as SettingsIcon, Crown,
  Users, Wallet, LogOut,
} from 'lucide-react'
import Logo from './Logo'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, hint: 'Statistik & ringkasan' },
  { id: 'kasir', label: 'Kasir', icon: ShoppingCart, hint: 'Transaksi POS' },
  { id: 'produk', label: 'Produk', icon: Package, hint: 'Kelola produk' },
  { id: 'order', label: 'Order', icon: ClipboardList, hint: 'Daftar pesanan' },
  { id: 'customers', label: 'Customers', icon: Users, hint: 'Database pelanggan' },
  { id: 'piutang', label: 'Piutang', icon: Wallet, hint: 'Hutang & cicilan' },
]

export default function Sidebar({
  activePage, setActivePage,
  mobileOpen, onMobileClose,
  storeInfo, currentUser, onOpenSettings, onLogout,
}) {
  const handleClick = (id) => {
    setActivePage(id)
    onMobileClose?.()
  }

  const isOwner = currentUser?.role === 'owner'

  const content = (
    <>
      {/* Logo */}
      <div className="flex items-center justify-between gap-3 px-5 py-5"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3 min-w-0">
          <Logo size={44} customSrc={storeInfo?.frontLogo} />
          <div className="min-w-0">
            <div className="font-bold text-sm leading-tight truncate"
              style={{ fontFamily: 'Syne', color: 'var(--text-primary)' }}>
              {(storeInfo?.name || 'Luby Naira').split(' ')[0]} POS
            </div>
            <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
              Printing Studio
            </div>
          </div>
        </div>
        <button
          onClick={onMobileClose}
          className="lg:hidden flex items-center justify-center rounded-lg"
          style={{
            width: 32, height: 32,
            background: 'rgba(255,255,255,0.04)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto">
        <div className="text-xs font-semibold uppercase tracking-wider mb-2 px-2"
          style={{ color: 'var(--text-muted)', fontFamily: 'Syne' }}>
          Menu Utama
        </div>
        {NAV.filter(({ id }) => isOwner || id !== 'dashboard').map(({ id, label, icon: Icon, hint }) => {
          const active = activePage === id
          return (
            <button
              key={id}
              onClick={() => handleClick(id)}
              className={`sidebar-item w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 text-left ${active ? 'active' : ''}`}
              style={{
                background: active ? 'rgba(139,92,246,0.12)' : 'transparent',
                color: active ? 'var(--accent-light)' : 'var(--text-secondary)',
              }}
            >
              <Icon size={17} style={{ opacity: active ? 1 : 0.6, flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm leading-tight" style={{ fontWeight: active ? 600 : 500 }}>
                  {label}
                </div>
                {active && (
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {hint}
                  </div>
                )}
              </div>
              {active && <ChevronRight size={14} style={{ opacity: 0.5, flexShrink: 0 }} />}
            </button>
          )
        })}
      </nav>

      {/* Bottom: Current user + Settings button */}
      <div className="p-3 space-y-2" style={{ borderTop: '1px solid var(--border)' }}>
        {currentUser && (
          <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{
                background: isOwner
                  ? 'linear-gradient(135deg, #f59e0b, #ea580c)'
                  : 'linear-gradient(135deg, var(--accent), #6366f1)',
                color: '#fff', fontFamily: 'Syne',
              }}>
              {(currentUser.username || '?')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                  {currentUser.name || currentUser.username}
                </span>
                {isOwner && <Crown size={10} style={{ color: '#f59e0b' }} />}
              </div>
              <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                @{currentUser.username}
              </div>
            </div>
          </div>
        )}

        {/* Owner: tombol Pengaturan; Staff: tombol Logout (no Settings) */}
        {isOwner ? (
          <button
            onClick={() => { onOpenSettings?.(); onMobileClose?.() }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all sidebar-item"
            style={{
              background: 'rgba(255,255,255,0.03)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            <SettingsIcon size={16} style={{ color: 'var(--accent-light)' }} />
            <span className="text-sm font-semibold flex-1" style={{ fontFamily: 'Syne' }}>
              Pengaturan
            </span>
            <ChevronRight size={13} style={{ opacity: 0.5 }} />
          </button>
        ) : (
          <button
            onClick={() => {
              if (window.confirm('Keluar dari aplikasi?')) {
                onLogout?.()
                onMobileClose?.()
              }
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all sidebar-item"
            style={{
              background: 'rgba(255,77,106,0.06)',
              color: 'var(--red)',
              border: '1px solid rgba(255,77,106,0.25)',
            }}
          >
            <LogOut size={16} style={{ color: 'var(--red)' }} />
            <span className="text-sm font-semibold flex-1" style={{ fontFamily: 'Syne' }}>
              Logout
            </span>
            <ChevronRight size={13} style={{ opacity: 0.5 }} />
          </button>
        )}
      </div>
    </>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col h-full"
        style={{
          width: 240,
          minWidth: 240,
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border)',
        }}>
        {content}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 drawer-overlay"
            onClick={onMobileClose}
          />
          <aside
            className="lg:hidden fixed left-0 top-0 bottom-0 z-50 flex flex-col animate-slideInLeft"
            style={{
              width: 260,
              background: 'var(--bg-secondary)',
              borderRight: '1px solid var(--border)',
            }}>
            {content}
          </aside>
        </>
      )}
    </>
  )
}
