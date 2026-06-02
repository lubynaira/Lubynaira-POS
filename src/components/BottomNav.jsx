import React from 'react'
import {
  LayoutDashboard, ShoppingCart, Users, Wallet, MoreHorizontal,
} from 'lucide-react'

const ITEMS = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'kasir', label: 'Kasir', icon: ShoppingCart },
  { id: 'customers', label: 'Customer', icon: Users },
  { id: 'piutang', label: 'Piutang', icon: Wallet },
]

/**
 * Bottom navigation for iOS / Android mobile feel.
 * Visible on `< md` viewport only.
 */
export default function BottomNav({ activePage, onChange, onMore, currentUser }) {
  const isOwner = currentUser?.role === 'owner'
  const items = ITEMS.filter(it => isOwner || it.id !== 'dashboard')
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around"
      style={{
        background: 'rgba(17, 17, 24, 0.85)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderTop: '1px solid var(--border)',
        // safe-area for iPhone home indicator
        paddingBottom: 'env(safe-area-inset-bottom)',
        height: 'calc(64px + env(safe-area-inset-bottom))',
      }}
    >
      {items.map(({ id, label, icon: Icon }) => {
        const active = activePage === id
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 transition-all"
            style={{
              color: active ? 'var(--accent-light)' : 'var(--text-muted)',
              padding: '8px 4px',
            }}
          >
            <div
              className="flex items-center justify-center rounded-xl transition-all"
              style={{
                width: 36,
                height: 28,
                background: active ? 'rgba(139,92,246,0.15)' : 'transparent',
              }}
            >
              <Icon size={17} />
            </div>
            <span
              className="text-[10px] font-semibold"
              style={{ fontFamily: 'Syne', fontWeight: active ? 700 : 500 }}
            >
              {label}
            </span>
          </button>
        )
      })}
      <button
        onClick={onMore}
        className="flex flex-col items-center justify-center gap-0.5 flex-1 transition-all"
        style={{
          color: 'var(--text-muted)',
          padding: '8px 4px',
        }}
      >
        <div
          className="flex items-center justify-center rounded-xl"
          style={{ width: 36, height: 28 }}
        >
          <MoreHorizontal size={17} />
        </div>
        <span className="text-[10px] font-semibold" style={{ fontFamily: 'Syne' }}>
          More
        </span>
      </button>
    </nav>
  )
}
