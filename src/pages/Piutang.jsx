import React, { useMemo, useState } from 'react'
import {
  Search, Wallet, Trash2, AlertTriangle, CalendarDays, Crown,
  CheckCircle2, History, Loader2, TrendingDown,
} from 'lucide-react'
import { Input, Button, Badge, EmptyState } from '../components/ui'
import Modal from '../components/Modal'
import WhatsAppButton from '../components/WhatsAppButton'
import WhatsAppReminder from '../components/WhatsAppReminder'
import { formatRupiah, formatDate, timeAgo } from '../utils/helpers'
import { TEMPLATES } from '../utils/whatsapp'
import { useToast } from '../components/Toast'

const STATUS_OPTIONS = [
  { id: 'all', label: 'Semua' },
  { id: 'aktif', label: 'Aktif' },
  { id: 'lunas', label: 'Lunas' },
]

export default function Piutang({
  debts, customers, transactions, stats, storeInfo,
  payDebt, deleteDebt, getDebtPayments,
}) {
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('aktif')
  const [payTarget, setPayTarget] = useState(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('cash')
  const [paying, setPaying] = useState(false)
  const [delTarget, setDelTarget] = useState(null)
  const [historyTarget, setHistoryTarget] = useState(null)
  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const enriched = useMemo(() => {
    // Setiap card menampilkan SISA yang DIDERIVASI dari totalDebt - paid,
    // bukan `debt.remaining` mentah. Ini mencegah card menampilkan angka
    // salah kalau ada drift di DB antara remaining vs (totalDebt - paid).
    return debts.map(d => {
      const totalDebt = +d.totalDebt || 0
      const paid = +d.paid || 0
      const derivedRemaining = Math.max(0, totalDebt - paid)
      return {
        ...d,
        // Override `remaining` dengan nilai yang konsisten secara matematis
        remaining: derivedRemaining,
        customer: customers.find(c => c.id === d.customerId) || { name: 'Customer dihapus', phone: '', whatsapp: '' },
      }
    })
  }, [debts, customers])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return enriched.filter(d => {
      const matchQ = !q ||
        (d.customer.name || '').toLowerCase().includes(q) ||
        (d.invoiceNo || '').toLowerCase().includes(q)
      const matchFilter = filter === 'all' ? true : d.status === filter
      return matchQ && matchFilter
    })
  }, [enriched, search, filter])

  const handleOpenPay = (d) => {
    setPayTarget(d)
    setPayAmount(String(d.remaining || 0))
    setPayMethod('cash')
  }

  const handlePay = async () => {
    if (paying) return
    // Strip non-digit dari payAmount (UI sekarang pakai formatted string)
    const amount = Number(String(payAmount).replace(/[^\d]/g, ''))
    if (!amount || amount <= 0) return toast.error('Nominal harus > 0')
    // Validasi terhadap sisa yang DIDERIVASI (totalDebt - paid), bukan dari
    // debt.remaining mentah yang bisa stale.
    const derivedRemaining = Math.max(0, (+payTarget.totalDebt || 0) - (+payTarget.paid || 0))
    if (amount > derivedRemaining) return toast.error('Nominal pembayaran melebihi sisa hutang')
    setPaying(true)
    try {
      const res = await payDebt(payTarget.id, amount, payMethod, '')
      if (res.ok) {
        toast.success('Pembayaran tercatat')
        setPayTarget(null); setPayAmount('')
      } else {
        toast.error(res.error || 'Gagal mencatat pembayaran')
      }
    } finally { setPaying(false) }
  }

  const handleDelete = async () => {
    if (!delTarget) return
    const res = await deleteDebt(delTarget.id)
    if (res.ok) { toast.success('Hutang dihapus'); setDelTarget(null) }
    else toast.error(res.error || 'Gagal')
  }

  const openHistory = async (d) => {
    setHistoryTarget(d)
    setLoadingHistory(true)
    const res = await getDebtPayments(d.id)
    setHistory(res.data || [])
    setLoadingHistory(false)
  }

  return (
    <div className="flex-1 overflow-y-auto mesh-bg">
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-5">
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Piutang Pelanggan</div>
          <h2 className="text-xl sm:text-2xl font-bold mt-0.5"
            style={{ fontFamily: 'Syne', color: 'var(--text-primary)' }}>
            {debts.length} catatan hutang
          </h2>
        </div>

        {/* Stat strips */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-5">
          <div className="rounded-2xl p-4" style={{
            background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(234,88,12,0.04))',
            border: '1px solid rgba(245,158,11,0.25)',
          }}>
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown size={13} style={{ color: '#f59e0b' }} />
              <p className="text-xs font-semibold" style={{ color: '#f59e0b', fontFamily: 'Syne' }}>
                Piutang Aktif
              </p>
            </div>
            <p className="text-base sm:text-lg font-bold truncate"
              style={{ color: '#f59e0b', fontFamily: 'Syne' }}>
              {formatRupiah(stats.totalActiveDebt)}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {stats.activeDebtsCount} customer aktif
            </p>
          </div>
          <div className="rounded-2xl p-4" style={{
            background: 'linear-gradient(135deg, rgba(16,217,138,0.08), rgba(5,150,105,0.04))',
            border: '1px solid rgba(16,217,138,0.25)',
          }}>
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 size={13} style={{ color: '#10d98a' }} />
              <p className="text-xs font-semibold" style={{ color: '#10d98a', fontFamily: 'Syne' }}>
                Sudah Lunas
              </p>
            </div>
            <p className="text-base sm:text-lg font-bold truncate"
              style={{ color: '#10d98a', fontFamily: 'Syne' }}>
              {formatRupiah(stats.totalPaidDebt)}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Total hutang yang sudah dilunasi
            </p>
          </div>
          <div className="rounded-2xl p-4"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 mb-1">
              <Crown size={13} style={{ color: 'var(--accent-light)' }} />
              <p className="text-xs font-semibold" style={{ color: 'var(--accent-light)', fontFamily: 'Syne' }}>
                Top Debtors
              </p>
            </div>
            <div className="space-y-1">
              {stats.topDebtors.slice(0, 2).map(d => (
                <div key={d.id} className="flex justify-between text-xs">
                  <span className="truncate" style={{ color: 'var(--text-secondary)' }}>{d.name}</span>
                  <span className="font-bold ml-2" style={{ color: '#f59e0b', fontFamily: 'Syne' }}>
                    {formatRupiah(d.totalRemaining)}
                  </span>
                </div>
              ))}
              {stats.topDebtors.length === 0 && (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Belum ada</p>
              )}
            </div>
          </div>
        </div>

        {/* Search + Filter */}
        <div className="flex gap-3 mb-5 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari customer atau invoice..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>
          <div className="flex gap-2">
            {STATUS_OPTIONS.map(s => (
              <button key={s.id} onClick={() => setFilter(s.id)}
                className="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: filter === s.id
                    ? 'linear-gradient(135deg, var(--accent), #6366f1)' : 'var(--bg-card)',
                  color: filter === s.id ? '#fff' : 'var(--text-secondary)',
                  border: `1px solid ${filter === s.id ? 'transparent' : 'var(--border)'}`,
                  fontFamily: 'Syne',
                }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <EmptyState icon={Wallet} title="Tidak ada piutang"
            description="Tidak ada data yang sesuai dengan filter saat ini" />
        ) : (
          <div className="space-y-3">
            {filtered.map((d, idx) => {
              const overdue = d.dueDate && new Date(d.dueDate) < new Date() && d.status === 'aktif'
              const phoneForWA = d.customer.whatsapp || d.customer.phone
              return (
                <div key={d.id}
                  className="rounded-2xl p-4 animate-fadeIn"
                  style={{
                    background: 'var(--bg-card)',
                    border: `1px solid ${overdue ? 'rgba(255,77,106,0.35)' : 'var(--border)'}`,
                    animationDelay: `${idx * 30}ms`,
                  }}>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold"
                      style={{
                        background: d.status === 'lunas'
                          ? 'linear-gradient(135deg, #10d98a, #059669)'
                          : overdue
                          ? 'linear-gradient(135deg, #ff4d6a, #c2185b)'
                          : 'linear-gradient(135deg, #f59e0b, #ea580c)',
                        color: '#fff', fontFamily: 'Syne',
                      }}>
                      {d.customer.name[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        <p className="text-sm font-bold truncate"
                          style={{ color: 'var(--text-primary)', fontFamily: 'Syne' }}>
                          {d.customer.name}
                        </p>
                        {d.status === 'lunas' ? <Badge color="green">LUNAS</Badge> : <Badge color="amber">AKTIF</Badge>}
                        {overdue && <Badge color="red">JATUH TEMPO</Badge>}
                      </div>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {d.invoiceNo || '—'} · {timeAgo(d.createdAt)}
                        {d.dueDate && <> · <CalendarDays size={9} className="inline" /> {formatDate(d.dueDate)}</>}
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-3 sm:gap-4 flex-shrink-0 items-center">
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>Total</p>
                        <p className="text-xs font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Syne', fontVariantNumeric: 'tabular-nums' }}>
                          {formatRupiah(d.totalDebt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>Dibayar</p>
                        <p className="text-xs font-bold" style={{ color: '#10d98a', fontFamily: 'Syne', fontVariantNumeric: 'tabular-nums' }}>
                          {formatRupiah(d.paid)}
                        </p>
                      </div>
                      {/* SISA HUTANG — red emphasis block (paling mencolok) */}
                      <div className="text-right rounded-xl px-3 py-2"
                        style={{
                          background: d.remaining > 0
                            ? 'rgba(239,68,68,0.10)'
                            : 'rgba(16,217,138,0.10)',
                          border: `1px solid ${d.remaining > 0 ? 'rgba(239,68,68,0.35)' : 'rgba(16,217,138,0.35)'}`,
                          boxShadow: d.remaining > 0
                            ? '0 0 12px rgba(239,68,68,0.18)'
                            : '0 0 12px rgba(16,217,138,0.18)',
                        }}>
                        <p className="text-[10px] uppercase tracking-widest font-bold"
                          style={{
                            color: d.remaining > 0 ? '#ef4444' : '#10d98a',
                            fontFamily: 'Syne',
                            letterSpacing: '0.12em',
                          }}>
                          {d.remaining > 0 ? 'Sisa Hutang' : 'Lunas'}
                        </p>
                        <p className="text-base font-extrabold"
                          style={{
                            color: d.remaining > 0 ? '#ef4444' : '#10d98a',
                            fontFamily: '"Space Grotesk", "Syne", sans-serif',
                            letterSpacing: '-0.01em',
                            fontVariantNumeric: 'tabular-nums',
                            textShadow: d.remaining > 0
                              ? '0 0 12px rgba(239,68,68,0.4)'
                              : '0 0 12px rgba(16,217,138,0.35)',
                          }}>
                          {formatRupiah(d.remaining)}
                        </p>
                        {d.remaining > 0 && (
                          <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold"
                            style={{
                              background: 'rgba(239,68,68,0.18)',
                              color: '#ef4444',
                              fontFamily: 'Syne',
                              letterSpacing: '0.06em',
                            }}>
                            BELUM LUNAS
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3 flex-wrap">
                    {d.status === 'aktif' && (
                      <button onClick={() => handleOpenPay(d)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold btn-press"
                        style={{
                          background: 'linear-gradient(135deg, #10d98a, #059669)',
                          color: '#fff', boxShadow: '0 2px 12px rgba(16,217,138,0.3)',
                          fontFamily: 'Syne',
                        }}>
                        <Wallet size={11} /> Bayar Cicilan
                      </button>
                    )}
                    {d.status === 'aktif' && (
                      <WhatsAppReminder
                        customer={d.customer}
                        remaining={d.remaining}
                        invoiceNo={d.invoiceNo}
                        dueDate={d.dueDate ? formatDate(d.dueDate) : null}
                        size="sm"
                        label="Kirim Reminder"
                      />
                    )}
                    <WhatsAppButton
                      phone={phoneForWA}
                      text={TEMPLATES.chat({ name: d.customer.name, storeName: storeInfo?.name })}
                      size="sm" variant="icon" tooltip="Chat Customer"
                    />
                    <button onClick={() => openHistory(d)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold btn-press"
                      style={{
                        background: 'rgba(139,92,246,0.1)', color: 'var(--accent-light)',
                        border: '1px solid rgba(139,92,246,0.2)', fontFamily: 'Syne',
                      }}>
                      <History size={11} /> Riwayat
                    </button>
                    <button onClick={() => setDelTarget(d)}
                      className="ml-auto w-7 h-7 rounded-xl flex items-center justify-center btn-press"
                      style={{
                        background: 'rgba(255,77,106,0.08)', color: 'var(--red)',
                        border: '1px solid rgba(255,77,106,0.15)',
                      }} title="Hapus">
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Pay modal — realtime simulation preview */}
      <Modal open={!!payTarget} onClose={() => setPayTarget(null)}
        title="Bayar Cicilan"
        subtitle={payTarget?.invoiceNo}
        size="sm">
        {payTarget && (() => {
          // ─── CANONICAL MATH ─────────────────────────────────────────
          // Sumber kebenaran adalah totalDebt - alreadyPaid (HASIL DIDERIVASI).
          // Kita TIDAK pakai debt.remaining mentah dari DB karena kalau
          // ada drift (mis. trigger lama belum update), nilainya bisa salah.
          //   totalDebt              → utang awal (tidak berubah saat dicicil)
          //   alreadyPaid            → akumulasi pembayaran sebelumnya
          //   currentPayment         → nominal yang sedang diketik kasir
          //   remainingBeforePayment = totalDebt - alreadyPaid
          //   remainingAfterPayment  = remainingBeforePayment - currentPayment
          const totalDebt = +payTarget.totalDebt || 0
          const alreadyPaid = +payTarget.paid || 0
          // currentPayment dari input — strip non-digit, parse ke number
          const currentPayment = Number(String(payAmount).replace(/[^\d]/g, '')) || 0

          const remainingBeforePayment = Math.max(0, totalDebt - alreadyPaid)
          const remainingAfterPayment = remainingBeforePayment - currentPayment

          const exceeds = currentPayment > remainingBeforePayment
          const willBeLunas = currentPayment > 0 && remainingAfterPayment <= 0 && !exceeds
          const willBePartial = currentPayment > 0 && remainingAfterPayment > 0 && !exceeds

          // Formatted display untuk input: "3.000.000"
          const formattedAmt = currentPayment > 0
            ? new Intl.NumberFormat('id-ID').format(currentPayment)
            : ''

          return (
            <div className="space-y-4">
              {/* TOP CARD — keadaan hutang saat ini (DIDERIVASI dari math) */}
              <div className="rounded-xl p-4 space-y-2"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--text-muted)' }}>Total Hutang</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontFamily: 'Syne', fontVariantNumeric: 'tabular-nums' }}>
                    {formatRupiah(totalDebt)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--text-muted)' }}>Sudah Dibayar</span>
                  <span style={{ color: '#10d98a', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {formatRupiah(alreadyPaid)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2"
                  style={{ borderTop: '1px dashed var(--border)' }}>
                  <span className="text-xs uppercase tracking-wider font-bold"
                    style={{ color: '#ef4444', fontFamily: 'Syne', letterSpacing: '0.08em' }}>
                    Sisa Sebelum Bayar
                  </span>
                  <span style={{
                    color: '#ef4444', fontWeight: 800, fontFamily: 'Syne',
                    fontSize: 18, fontVariantNumeric: 'tabular-nums',
                    textShadow: '0 0 16px rgba(239,68,68,0.35)',
                  }}>
                    {formatRupiah(remainingBeforePayment)}
                  </span>
                </div>
              </div>

              {/* INPUT — formatted thousand-separator while typing */}
              <div>
                <label className="block text-xs font-semibold mb-2"
                  style={{ color: 'var(--text-secondary)', fontFamily: 'Syne' }}>
                  Jumlah Bayar <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold"
                    style={{ color: 'var(--text-muted)', fontFamily: 'Syne' }}>
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    value={formattedAmt}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/[^\d]/g, '')
                      setPayAmount(digits)
                    }}
                    placeholder="0"
                    className="w-full pl-10 pr-3 py-3 rounded-xl text-lg font-bold"
                    style={{
                      background: 'var(--bg-card)',
                      border: `1px solid ${exceeds ? 'rgba(239,68,68,0.5)' : 'var(--border)'}`,
                      color: 'var(--text-primary)',
                      fontFamily: 'Syne',
                      fontVariantNumeric: 'tabular-nums',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* SIMULASI PEMBAYARAN — realtime panel */}
              <div className="rounded-2xl overflow-hidden animate-fadeIn"
                style={{
                  background: 'linear-gradient(180deg, rgba(139,92,246,0.06), rgba(99,102,241,0.04))',
                  border: '1px solid rgba(139,92,246,0.25)',
                }}>
                <div className="px-4 py-2 text-[10px] uppercase tracking-widest font-bold text-center"
                  style={{
                    color: 'var(--accent-light)',
                    fontFamily: 'Syne',
                    letterSpacing: '0.16em',
                    borderBottom: '1px solid rgba(139,92,246,0.18)',
                    background: 'rgba(139,92,246,0.08)',
                  }}>
                  Simulasi Pembayaran
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs uppercase tracking-wider"
                      style={{ color: 'var(--text-muted)', fontFamily: 'Syne', letterSpacing: '0.08em' }}>
                      Sisa Sebelum Bayar
                    </span>
                    <span className="font-bold"
                      style={{ color: '#ef4444', fontFamily: 'Syne', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
                      {formatRupiah(remainingBeforePayment)}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs uppercase tracking-wider"
                      style={{ color: 'var(--text-muted)', fontFamily: 'Syne', letterSpacing: '0.08em' }}>
                      Pembayaran Saat Ini
                    </span>
                    <span className="font-bold"
                      style={{ color: '#10d98a', fontFamily: 'Syne', fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>
                      {formatRupiah(currentPayment)}
                    </span>
                  </div>
                  {/* Sisa Setelah Pembayaran — angka TERBESAR di modal */}
                  <div className="pt-3"
                    style={{ borderTop: '1px dashed rgba(245,158,11,0.3)' }}>
                    <div className="text-[10px] uppercase tracking-widest font-bold mb-1"
                      style={{ color: '#f59e0b', fontFamily: 'Syne', letterSpacing: '0.14em' }}>
                      Sisa Setelah Pembayaran
                    </div>
                    <div
                      key={Math.max(0, remainingAfterPayment)}
                      className="animate-scaleIn"
                      style={{
                        fontSize: 28,
                        fontWeight: 800,
                        color: remainingAfterPayment <= 0 ? '#10d98a' : (exceeds ? '#ef4444' : '#fbbf24'),
                        fontFamily: '"Space Grotesk", "Syne", sans-serif',
                        letterSpacing: '-0.02em',
                        textShadow: remainingAfterPayment <= 0
                          ? '0 0 20px rgba(16,217,138,0.45)'
                          : (exceeds ? '0 0 20px rgba(239,68,68,0.5)' : '0 0 20px rgba(251,191,36,0.45)'),
                        fontVariantNumeric: 'tabular-nums',
                        transition: 'color 0.2s ease',
                      }}>
                      {formatRupiah(Math.max(0, remainingAfterPayment))}
                    </div>
                  </div>
                </div>
              </div>

              {/* VALIDATION BADGES */}
              {exceeds && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl animate-fadeIn"
                  style={{
                    background: 'rgba(239,68,68,0.12)',
                    border: '1px solid rgba(239,68,68,0.4)',
                    color: '#ef4444',
                  }}>
                  <AlertTriangle size={14} />
                  <span className="text-xs font-bold" style={{ fontFamily: 'Syne' }}>
                    Nominal melebihi sisa hutang
                  </span>
                </div>
              )}
              {willBeLunas && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl animate-fadeIn"
                  style={{
                    background: 'rgba(16,217,138,0.12)',
                    border: '1px solid rgba(16,217,138,0.4)',
                    color: '#10d98a',
                  }}>
                  <CheckCircle2 size={14} />
                  <span className="text-xs font-bold" style={{ fontFamily: 'Syne' }}>
                    Hutang Akan Lunas
                  </span>
                </div>
              )}
              {willBePartial && (
                <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl animate-fadeIn"
                  style={{
                    background: 'rgba(245,158,11,0.10)',
                    border: '1px solid rgba(245,158,11,0.35)',
                    color: '#f59e0b',
                  }}>
                  <span className="flex items-center gap-2 text-xs font-bold" style={{ fontFamily: 'Syne' }}>
                    <AlertTriangle size={14} /> Sisa Setelah Pembayaran
                  </span>
                  <span className="text-xs font-bold" style={{ fontFamily: 'Syne', fontVariantNumeric: 'tabular-nums' }}>
                    {formatRupiah(remainingAfterPayment)}
                  </span>
                </div>
              )}

              {/* PAYMENT METHOD */}
              <div>
                <label className="block text-xs font-semibold mb-2"
                  style={{ color: 'var(--text-secondary)', fontFamily: 'Syne' }}>
                  Metode Pembayaran
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'cash', label: 'Cash', icon: '💵' },
                    { id: 'transfer', label: 'Transfer', icon: '🏦' },
                    { id: 'qris', label: 'QRIS', icon: '📱' },
                  ].map(m => (
                    <button key={m.id} onClick={() => setPayMethod(m.id)}
                      className="flex flex-col items-center gap-1 py-2 rounded-xl text-xs font-medium"
                      style={{
                        background: payMethod === m.id ? 'rgba(139,92,246,0.15)' : 'var(--bg-card)',
                        border: `1px solid ${payMethod === m.id ? 'rgba(139,92,246,0.4)' : 'var(--border)'}`,
                        color: payMethod === m.id ? 'var(--accent-light)' : 'var(--text-muted)',
                        fontFamily: 'Syne',
                      }}>
                      <span>{m.icon}</span> {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ACTIONS */}
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setPayTarget(null)} disabled={paying}>
                  Batal
                </Button>
                <Button variant="success" className="flex-1"
                  onClick={handlePay}
                  disabled={paying || exceeds || currentPayment <= 0}>
                  {paying ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  {paying ? 'Memproses...' : 'Konfirmasi'}
                </Button>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* History modal */}
      <Modal open={!!historyTarget} onClose={() => setHistoryTarget(null)}
        title="Riwayat Pembayaran" subtitle={historyTarget?.invoiceNo} size="md">
        {loadingHistory ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent-light)' }} />
          </div>
        ) : history.length === 0 ? (
          <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>
            Belum ada pembayaran
          </p>
        ) : (
          <div className="space-y-2">
            {history.map(p => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <CheckCircle2 size={14} style={{ color: '#10d98a' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {formatRupiah(p.amount)}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {timeAgo(p.paid_at)} · {p.payment_method} · oleh {p.cashier || '-'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!delTarget} onClose={() => setDelTarget(null)} title="Hapus Catatan Hutang" size="sm">
        <div className="text-center py-2">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(255,77,106,0.12)', border: '2px solid rgba(255,77,106,0.3)' }}>
            <AlertTriangle size={24} style={{ color: 'var(--red)' }} />
          </div>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            Hapus catatan hutang <strong>{delTarget?.invoiceNo}</strong>? Riwayat pembayaran juga akan terhapus.
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setDelTarget(null)}>Batal</Button>
            <Button variant="danger" className="flex-1" onClick={handleDelete}>Ya, Hapus</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
