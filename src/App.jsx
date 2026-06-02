import React, { useState, useEffect } from 'react'
import { AlertTriangle, Database, RefreshCw } from 'lucide-react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Settings from './components/Settings'
import BottomNav from './components/BottomNav'
import ErrorBoundary from './components/ErrorBoundary'
import Dashboard from './pages/Dashboard'
import Kasir from './pages/Kasir'
import Produk from './pages/Produk'
import Order from './pages/Order'
import Customers from './pages/Customers'
import Piutang from './pages/Piutang'
import Login from './pages/Login'
import Logo from './components/Logo'
import { ToastProvider, useToast } from './components/Toast'
import { useStore } from './hooks/useStore'

function LoadingSplash() {
  const [showSlow, setShowSlow] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setShowSlow(true), 3000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      className="flex flex-col items-center justify-center mesh-bg p-6"
      style={{ minHeight: '100dvh', width: '100%' }}
    >
      <div
        style={{
          animation: 'splashPulse 2.2s ease-in-out infinite',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: 'Syne, sans-serif',
            fontWeight: 800,
            fontSize: 'clamp(48px, 14vw, 104px)',
            color: '#F2E500',
            letterSpacing: '-0.04em',
            lineHeight: 0.95,
            // subtle yellow glow under the wordmark
            textShadow:
              '0 0 24px rgba(242,229,0,0.35), 0 0 48px rgba(242,229,0,0.18)',
          }}
        >
          LUBY<br />NAIRA
        </div>
      </div>

      {/* Subtle slow-loading hint (only after 3s) */}
      <div
        style={{
          position: 'absolute',
          bottom: 'calc(env(safe-area-inset-bottom) + 32px)',
          left: 0, right: 0,
          textAlign: 'center',
          fontFamily: 'Syne, sans-serif',
          fontSize: 12,
          color: 'rgba(255,255,255,0.4)',
          letterSpacing: '0.04em',
          opacity: showSlow ? 1 : 0,
          transition: 'opacity 0.6s ease',
        }}
      >
        Menyiapkan sistem...
      </div>

      <style>{`
        @keyframes splashPulse {
          0%, 100% { opacity: 0.78; transform: scale(1); }
          50%      { opacity: 1; transform: scale(1.025); }
        }
      `}</style>
    </div>
  )
}

function ErrorScreen({ error, onRetry }) {
  return (
    <div className="min-h-screen flex items-center justify-center mesh-bg p-6">
      <div
        className="max-w-md w-full rounded-2xl p-7 animate-scaleIn"
        style={{
          background: 'rgba(28,28,40,0.85)',
          backdropFilter: 'blur(20px)',
          border: '1px solid var(--border-strong)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
        }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 mx-auto"
          style={{ background: 'rgba(255,77,106,0.12)', border: '1px solid rgba(255,77,106,0.3)' }}
        >
          <AlertTriangle size={28} style={{ color: 'var(--red)' }} />
        </div>
        <h2 className="font-bold text-xl text-center mb-2"
          style={{ fontFamily: 'Syne', color: 'var(--text-primary)' }}>
          Tidak Dapat Terhubung
        </h2>
        <p className="text-sm text-center mb-5" style={{ color: 'var(--text-secondary)' }}>
          {error}
        </p>
        <div className="rounded-xl p-4 mb-5 text-xs space-y-2"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          <div className="flex items-center gap-2 font-semibold"
            style={{ color: 'var(--accent-light)', fontFamily: 'Syne' }}>
            <Database size={13} /> Cara setup
          </div>
          <ol className="list-decimal pl-4 space-y-1">
            <li>Buat project di <strong>supabase.com</strong></li>
            <li>Jalankan <code>supabase/schema.sql</code> di SQL Editor</li>
            <li>Copy <code>.env.example</code> → <code>.env</code> isi URL + anon key</li>
            <li>Restart <code>npm run dev</code></li>
          </ol>
        </div>
        <button
          onClick={onRetry}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold btn-press"
          style={{
            background: 'linear-gradient(135deg, var(--accent), #6366f1)',
            color: '#fff',
            boxShadow: '0 4px 16px rgba(139,92,246,0.35)',
            fontFamily: 'Syne',
          }}
        >
          <RefreshCw size={14} /> Coba Lagi
        </button>
      </div>
    </div>
  )
}

function AppShell() {
  // Default starting page tergantung role — admin/cashier langsung ke Kasir
  // (Dashboard digated untuk owner saja).
  const store = useStore()
  const toast = useToast()
  const isOwner = store.currentUser?.role === 'owner'
  const [activePage, setActivePageRaw] = useState(isOwner ? 'dashboard' : 'kasir')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Wrap setActivePage: kalau non-owner mencoba membuka 'dashboard',
  // tampilkan toast dan redirect ke 'kasir'. Tidak ada cara akses tersembunyi.
  const setActivePage = (next) => {
    if (next === 'dashboard' && !isOwner) {
      toast.warning('Dashboard hanya dapat diakses oleh Admin Utama')
      setActivePageRaw('kasir')
      return
    }
    setActivePageRaw(next)
  }

  // Saat role berubah (mis. user logout lalu login lagi sebagai admin biasa),
  // pastikan tidak nyangkut di Dashboard.
  useEffect(() => {
    if (!isOwner && activePage === 'dashboard') {
      setActivePageRaw('kasir')
    }
  }, [isOwner, activePage])

  if (store.loading) return <LoadingSplash />
  if (store.error) return <ErrorScreen error={store.error} onRetry={store.refreshAll} />
  if (!store.currentUser) {
    return <Login login={store.login} storeInfo={store.storeInfo} busy={store.busy} />
  }

  // Filter transaksi berdasar role:
  //   • owner   → semua transaksi
  //   • admin/cashier → hanya transaksi yang dia buat (cashier_id == user.id)
  // Owner dashboard menerima FULL list (untuk filter per-admin di UI).
  // Halaman lain (Order/Customers/Piutang) menerima list yang sudah disaring.
  const scopedTransactions = isOwner
    ? store.transactions
    : store.transactions.filter(t => t.cashierId === store.currentUser?.id)
  const scopedDebts = isOwner
    ? store.debts
    : store.debts.filter(d => {
        // Hutang dianggap milik kasir yang membuat transaksi-nya
        const linked = store.transactions.find(t => t.id === d.transactionId)
        return !linked || linked.cashierId === store.currentUser?.id
      })

  const pages = {
    dashboard: <Dashboard
      stats={store.stats}
      transactions={store.transactions}
      debts={store.debts}
      admins={store.admins}
      storeInfo={store.storeInfo}
      currentUser={store.currentUser}
      setActivePage={setActivePage}
    />,
    kasir: <Kasir
      products={store.products}
      customers={store.customers}
      addTransaction={store.addTransaction}
      storeInfo={store.storeInfo}
      busy={store.busy}
    />,
    produk: <Produk
      products={store.products}
      addProduct={store.addProduct}
      updateProduct={store.updateProduct}
      deleteProduct={store.deleteProduct}
      busy={store.busy}
    />,
    order: <Order
      transactions={scopedTransactions}
      products={store.products}
      customers={store.customers}
      storeInfo={store.storeInfo}
      currentUser={store.currentUser}
      updateTransactionStatus={store.updateTransactionStatus}
      updateTransactionPayment={store.updateTransactionPayment}
      updateOrderStatus={store.updateOrderStatus}
      deleteTransaction={store.deleteTransaction}
      busy={store.busy}
    />,
    customers: <Customers
      customers={store.customers}
      transactions={scopedTransactions}
      storeInfo={store.storeInfo}
      addCustomer={store.addCustomer}
      updateCustomer={store.updateCustomer}
      deleteCustomer={store.deleteCustomer}
    />,
    piutang: <Piutang
      debts={scopedDebts}
      customers={store.customers}
      transactions={scopedTransactions}
      storeInfo={store.storeInfo}
      stats={store.stats}
      payDebt={store.payDebt}
      deleteDebt={store.deleteDebt}
      getDebtPayments={store.getDebtPayments}
    />,
  }

  return (
    <div
      className="flex w-screen overflow-hidden"
      style={{
        background: 'var(--bg-primary)',
        // Use 100dvh (dynamic viewport height) to handle mobile Safari URL bar
        // Fallback to 100vh for older browsers
        height: '100dvh',
        minHeight: '100vh',
      }}
    >
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
        storeInfo={store.storeInfo}
        currentUser={store.currentUser}
        // Only owner can open Settings — staff sees Logout button instead
        onOpenSettings={isOwner ? () => setSettingsOpen(true) : undefined}
        onLogout={store.logout}
      />
      <main className="flex flex-1 flex-col overflow-hidden" style={{ minWidth: 0 }}>
        <Header
          activePage={activePage}
          onMenuToggle={() => setMobileMenuOpen(true)}
          currentUser={store.currentUser}
          // Only owner can open Settings via header chip
          onOpenSettings={isOwner ? () => setSettingsOpen(true) : undefined}
          onLogout={store.logout}
          onRefresh={store.refreshAll}
        />
        <div
          className="flex-1 overflow-hidden flex flex-col"
          style={{
            minHeight: 0,
            // Reserve space for the mobile bottom nav on small screens
            paddingBottom: 0,
          }}
        >
          <ErrorBoundary
            key={activePage}
            title={`Halaman ${activePage} gagal dimuat`}
          >
            {pages[activePage]}
          </ErrorBoundary>
        </div>
      </main>

      <BottomNav
        activePage={activePage}
        onChange={setActivePage}
        onMore={() => setMobileMenuOpen(true)}
        currentUser={store.currentUser}
      />

      {/* Settings modal — OWNER ONLY (security: not just hidden, refuse to render) */}
      <Settings
        open={settingsOpen && isOwner}
        onClose={() => setSettingsOpen(false)}
        storeInfo={store.storeInfo}
        admins={store.admins}
        currentUser={store.currentUser}
        busy={store.busy}
        updateStoreInfo={store.updateStoreInfo}
        updateLogo={store.updateLogo}
        addAdmin={store.addAdmin}
        deleteAdmin={store.deleteAdmin}
        changePassword={store.changePassword}
        logout={() => { setSettingsOpen(false); store.logout() }}
      />
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary title="Aplikasi gagal dimuat">
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </ErrorBoundary>
  )
}
