import React, { useState, useMemo, useEffect } from 'react'
import {
  Search, ShoppingCart, Plus, Minus, Trash2, Tag, Receipt, Printer,
  CheckCircle2, X, Package, User, Calendar,
} from 'lucide-react'
import { CATEGORIES, PAYMENT_METHODS } from '../data/dummyData'
import {
  formatRupiah, toDateInputValue,
  getUnit, formatQty,
} from '../utils/helpers'
import { Button, ProductImage, EmptyState } from '../components/ui'
import Invoice from '../components/Invoice'

// ---------- QtyInput ----------
// Decimal-safe quantity input with a LOCAL draft string.
// Why local draft: when user types "1," the comma must remain visible —
// if we re-derive `value` from the numeric qty every keystroke, the comma
// disappears immediately ("1," → 1 → "1"). Local draft lets the keystroke
// survive while still bubbling parsed numeric qty up to the cart store.
//
// Rules:
//   • PCS  → integer only (1, 2, 3 …)
//   • Meter/Yard → decimals allowed, comma (1,5) OR dot (1.5)
//   • minimum 0,1  •  never negative  •  empty allowed while editing
//   • on blur, empty/invalid resets to "1"
function QtyInput({ qty, allowDecimal, onChange, onCommit }) {
  // Format a number back into the local display string.
  // For PCS we keep the raw integer (no thousand separators while editing —
  // that complicates cursor position). The cart's "Subtotal · N PCS" line
  // and the invoice handle formatted display via formatQty().
  const fmt = (n) => {
    const num = Number(n) || 0
    if (!allowDecimal) return String(Math.round(num))
    if (Number.isInteger(num)) return String(num)
    // Trim trailing zeros: 1.50 → "1,5"; 2.25 → "2,25"
    return num.toFixed(2).replace(/\.?0+$/, '').replace('.', ',')
  }
  const [draft, setDraft] = useState(() => fmt(qty))

  // If qty changes externally (e.g. +/- buttons), refresh the draft.
  // But DON'T overwrite the draft if it already parses to the same value —
  // otherwise the cursor jumps while the user is still typing.
  useEffect(() => {
    const draftNum = parseFloat(String(draft).replace(',', '.'))
    if (Number.isFinite(draftNum) && Math.abs(draftNum - (Number(qty) || 0)) < 0.001) {
      return
    }
    setDraft(fmt(qty))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qty, allowDecimal])

  const handleChange = (e) => {
    let raw = e.target.value
    if (allowDecimal) {
      // Keep only digits + ONE separator. Preserve trailing "1," etc.
      raw = raw.replace(/[^\d.,]/g, '')
      // If both . and , appear, keep the LAST one as the separator
      const lastDot = raw.lastIndexOf('.')
      const lastComma = raw.lastIndexOf(',')
      const lastSep = Math.max(lastDot, lastComma)
      if (lastSep !== -1) {
        const before = raw.slice(0, lastSep).replace(/[.,]/g, '')
        const sep = raw[lastSep]
        const after = raw.slice(lastSep + 1).replace(/[.,]/g, '')
        raw = before + sep + after
      }
    } else {
      raw = raw.replace(/[^\d]/g, '')
    }
    setDraft(raw)
    // Parse & bubble up — but if the draft is empty or ends in a separator,
    // do NOT clobber the cart with 0 (user is mid-typing).
    if (raw === '' || raw === ',' || raw === '.' || raw.endsWith(',') || raw.endsWith('.')) {
      return
    }
    const normalized = raw.replace(',', '.')
    const n = allowDecimal ? parseFloat(normalized) : parseInt(normalized, 10)
    if (Number.isFinite(n) && n > 0) {
      onChange(allowDecimal ? Math.round(n * 100) / 100 : Math.round(n))
    }
  }

  const handleBlur = () => {
    const cleaned = draft.replace(',', '.').replace(/[^\d.]/g, '')
    let n = allowDecimal ? parseFloat(cleaned) : parseInt(cleaned, 10)
    // Enforce minimum 0.1 (decimal) / 1 (pcs); empty/invalid → 1
    if (!Number.isFinite(n) || n <= 0) n = 1
    if (allowDecimal) {
      if (n < 0.1) n = 0.1
      n = Math.round(n * 100) / 100
    } else {
      n = Math.round(n)
      if (n < 1) n = 1
    }
    setDraft(fmt(n))
    onChange(n)
    if (onCommit) onCommit(n)
  }

  return (
    <input
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      pattern={allowDecimal ? '[0-9.,]*' : '[0-9]*'}
      value={draft}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={(e) => e.target.select()}
      aria-label="Jumlah"
      className="qty-input text-center text-base font-bold"
      style={{
        // 96px fits up to ~8 digits in Syne — "10.000.000" easily, while
        // staying compact enough for iPhone portrait. Tabular-nums keeps
        // digits aligned so the value never feels cropped mid-typing.
        width: 96,
        minWidth: 72,
        maxWidth: 120,
        minHeight: 44,
        padding: '0 6px',
        background: 'transparent',
        border: 'none',
        color: 'var(--text-primary)',
        fontFamily: 'Syne',
        outline: 'none',
        fontVariantNumeric: 'tabular-nums',
      }}
    />
  )
}

export default function Kasir({ products, customers = [], addTransaction, storeInfo, busy, categories = CATEGORIES }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [cart, setCart] = useState([])
  // Discount stored as STRING so the input can be truly empty when 0.
  // All math coerces via Number(discount || 0).
  const [discount, setDiscount] = useState('')
  const [discountType, setDiscountType] = useState('nominal')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [customerName, setCustomerName] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [dp, setDp] = useState('')
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 14)
    return toDateInputValue(d)
  })
  const [successTrx, setSuccessTrx] = useState(null)
  const [showInvoice, setShowInvoice] = useState(false)
  const [autoShareWA, setAutoShareWA] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchCat = category === 'all' || p.category === category
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
      return matchCat && matchSearch
    })
  }, [products, search, category])

  // NO QUANTITY LIMITS — Luby Naira POS sells made-to-order goods (sablon, DTF,
  // jersey, kain) so customers freely order 1, 58, 500, 1.000, 10.000+ unit.
  // We intentionally ignore product.stock as a cap; stock decrement on the
  // backend still happens (Math.max-floored at 0) but the cart is unbounded.

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id)
      if (existing) {
        const next = Number(existing.qty) + 1
        return prev.map((i) =>
          i.productId === product.id ? { ...i, qty: next } : i
        )
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          price: product.price,
          qty: 1,
          image: product.image,
          // We keep stock on the cart item only for diagnostics; it is
          // never used as a cap in any handler.
          stock: product.stock,
          unit: (product.unit || 'pcs').toLowerCase(),
        },
      ]
    })
  }

  const updateQty = (productId, delta) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.productId !== productId) return i
          const next = Number(i.qty) + delta
          // Round to 2 decimals for meter/yard, integer for pcs
          const rounded = (i.unit === 'meter' || i.unit === 'yard')
            ? Math.round(next * 100) / 100
            : Math.round(next)
          return { ...i, qty: rounded }
        })
        .filter((i) => Number(i.qty) > 0)
    )
  }

  // Set exact qty from a numeric value (QtyInput already handles parsing
  // + comma/dot normalization). Unlimited — no stock cap whatsoever.
  const setQtyExact = (productId, n) => {
    setCart((prev) => prev.map((i) => {
      if (i.productId !== productId) return i
      const allowDecimal = i.unit === 'meter' || i.unit === 'yard'
      let qty = Number(n)
      if (!Number.isFinite(qty) || qty <= 0) qty = allowDecimal ? 0.1 : 1
      if (allowDecimal) qty = Math.round(qty * 100) / 100
      else qty = Math.round(qty)
      return { ...i, qty }
    }))
  }

  const removeItem = (productId) =>
    setCart((prev) => prev.filter((i) => i.productId !== productId))

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const discountAmount =
    discountType === 'persen'
      ? Math.round((subtotal * Number(discount || 0)) / 100)
      : Math.min(subtotal, Number(discount) || 0)
  const afterDiscount = Math.max(0, subtotal - discountAmount)
  const taxAmount = 0
  const total = afterDiscount
  const dpAmount = Number(dp) || 0
  const remaining = Math.max(0, total - dpAmount)

  const handleCheckout = async () => {
    if (cart.length === 0 || checkingOut) return

    // Validation — only block on actually-missing requirements
    const isHutang = paymentMethod === 'hutang'

    // Nama pelanggan WAJIB diisi untuk SEMUA metode pembayaran.
    // Boleh berasal dari customer picker (otomatis terisi) atau diketik manual.
    const finalCustomerName = (customerName || '').trim()
    if (!finalCustomerName) {
      setCheckoutError('Nama pelanggan wajib diisi sebelum checkout')
      return
    }

    if (isHutang) {
      if (!customerId) {
        setCheckoutError('Tolong pilih customer terlebih dahulu')
        return
      }
      if (!dueDate) {
        setCheckoutError('Tolong pilih tanggal jatuh tempo')
        return
      }
    }

    setCheckingOut(true)
    setCheckoutError('')
    try {
      const paidAmt = isHutang
        ? (dpAmount > 0 ? Math.min(total, dpAmount) : 0)
        : Math.min(total, dpAmount > 0 ? dpAmount : total)
      const remainingAmt = isHutang
        ? Math.max(0, total - paidAmt)
        : (dpAmount > 0 ? remaining : 0)

      const picked = customerId ? customers.find(c => c.id === customerId) : null
      const trx = {
        // Nama selalu hasil dari validasi di atas; tidak ada fallback "Umum".
        customer: finalCustomerName,
        customerId: customerId || null,
        customerPhone: picked?.whatsapp || picked?.phone || '',
        customerAddress: picked?.address || '',
        // Strip 'stock' DAN 'image' dari item — image bisa base64 puluhan KB
        // dan tidak dibutuhkan untuk render invoice (Invoice cuma pakai nama,
        // qty, harga). Memastikan items JSONB tetap ramping → tabel
        // transactions tidak membengkak → SELECT * tetap cepat.
        items: cart.map(({ stock, image, ...rest }) => rest),
        subtotal,
        discount: discountAmount,
        tax: taxAmount,
        total,
        paid: paidAmt,
        dp: paidAmt,
        remaining: remainingAmt,
        paymentMethod,
        status: remainingAmt > 0 ? 'pending' : 'lunas',
        dueDate: isHutang ? dueDate : null,
        // Workflow status — hutang starts as menunggu pembayaran
        orderStatus: 'menunggu',
      }

      let result
      try {
        result = await addTransaction(trx)
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[Kasir] addTransaction crashed:', err)
        setCheckoutError(`Gagal: ${err?.message || String(err)}`)
        return
      }

      if (!result || !result.ok) {
        const errMsg = result?.error || 'Gagal memproses transaksi (cek koneksi Supabase)'
        // eslint-disable-next-line no-console
        console.error('[Kasir] addTransaction returned error:', errMsg, result)
        setCheckoutError(errMsg)
        return
      }

      setSuccessTrx(result.data)
      setCart([])
      setDiscount('')
      setDp('')
      setCustomerName('')
      setCustomerId('')
      setPaymentMethod('cash')
      setCartOpen(false)
      // Always show the success popup first (NOT invoice preview).
      // User picks: Print Invoice / Kirim WhatsApp / Selesai from popup.
      setShowInvoice(false)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[Kasir] checkout outer error:', err)
      setCheckoutError(err?.message || 'Terjadi kesalahan tak terduga')
    } finally {
      setCheckingOut(false)
    }
  }

  const cartCount = cart.reduce((s, i) => s + i.qty, 0)

  // --- Cart UI (reused for desktop column + mobile drawer) ---
  const cartContent = (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-secondary)' }}>
      {/* Cart Header */}
      <div className="px-4 sm:px-5 py-4 flex items-center gap-2"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <ShoppingCart size={16} style={{ color: 'var(--accent-light)' }} />
        <span className="font-bold text-sm"
          style={{ fontFamily: 'Syne', color: 'var(--text-primary)' }}>
          Keranjang
        </span>
        {cart.length > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full font-bold"
            style={{
              background: 'linear-gradient(135deg, var(--accent), #6366f1)',
              color: '#fff',
              fontFamily: 'Syne',
              boxShadow: '0 2px 8px rgba(139,92,246,0.4)',
            }}>
            {cartCount}
          </span>
        )}
        <button
          onClick={() => setCartOpen(false)}
          className="lg:hidden ml-auto w-8 h-8 flex items-center justify-center rounded-lg"
          style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Customer picker */}
      <div className="px-4 py-3 space-y-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="relative">
          <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-muted)' }} />
          <input
            value={customerName}
            onChange={(e) => {
              setCustomerName(e.target.value)
              setCustomerSearch(e.target.value)
              setCustomerId('')
            }}
            placeholder="Nama pelanggan wajib diisi"
            required
            className="w-full pl-8 pr-3 py-2 rounded-xl text-xs"
            style={{
              background: 'var(--bg-card)',
              // Border kuning kalau kosong (peringatan), amber kalau hutang+belum pilih customer
              border: `1px solid ${
                !customerName.trim()
                  ? 'rgba(245,158,11,0.45)'
                  : (paymentMethod === 'hutang' && !customerId
                      ? 'rgba(245,158,11,0.4)'
                      : 'var(--border)')
              }`,
              color: 'var(--text-primary)',
            }}
          />
        </div>
        {customerSearch && !customerId && customers.length > 0 && (() => {
          const q = customerSearch.toLowerCase()
          const matches = customers.filter(c =>
            c.name.toLowerCase().includes(q) || (c.phone || '').includes(q)
          ).slice(0, 5)
          if (matches.length === 0) return null
          return (
            <div className="rounded-xl overflow-hidden max-h-40 overflow-y-auto"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
              {matches.map(c => (
                <button key={c.id}
                  onClick={() => {
                    setCustomerId(c.id)
                    setCustomerName(c.name)
                    setCustomerSearch('')
                    // Capture phone+address for invoice
                    if (c.whatsapp || c.phone) {
                      // these will be passed when checkout completes
                    }
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-white/[0.03] transition-all"
                  style={{ borderBottom: '1px solid var(--border)' }}>
                  <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                    {c.name}
                  </p>
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                    {c.phone || '-'} {c.totalDebt > 0 && <span style={{ color: '#f59e0b' }}>• Hutang {formatRupiah(c.totalDebt)}</span>}
                  </p>
                </button>
              ))}
            </div>
          )
        })()}
        {customerId && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs"
            style={{ background: 'rgba(16,217,138,0.08)', border: '1px solid rgba(16,217,138,0.25)', color: '#10d98a' }}>
            <CheckCircle2 size={11} />
            <span className="font-semibold truncate" style={{ fontFamily: 'Syne' }}>Customer terpilih</span>
            <button onClick={() => { setCustomerId(''); setCustomerName('') }}
              className="ml-auto" style={{ color: '#10d98a' }}>
              <X size={11} />
            </button>
          </div>
        )}
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
              <ShoppingCart size={26} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
            </div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)', fontFamily: 'Syne' }}>
              Keranjang Kosong
            </p>
            <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              Klik produk untuk menambahkan
            </p>
          </div>
        ) : (
          cart.map((item) => (
            <div key={item.productId}
              className="p-3 rounded-xl animate-slideInRight"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              {/* Row 1: Image + Name + Delete */}
              <div className="flex items-start gap-2.5 mb-2">
                <ProductImage
                  src={item.image}
                  alt={item.name}
                  className="w-11 h-11 rounded-lg object-cover flex-shrink-0"
                  fallbackSize={44}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-tight"
                    style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                    {item.name}
                  </p>
                  <p className="text-xs mt-0.5"
                    style={{ color: 'var(--text-muted)' }}>
                    {formatRupiah(item.price)} / {getUnit(item.unit).short}
                  </p>
                </div>
                <button
                  onClick={() => removeItem(item.productId)}
                  aria-label="Hapus item"
                  className="flex items-center justify-center btn-press flex-shrink-0"
                  style={{
                    width: 36, height: 36, minWidth: 36,
                    borderRadius: 10,
                    background: 'rgba(255,77,106,0.1)',
                    color: 'var(--red)',
                    border: '1px solid rgba(255,77,106,0.2)',
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Row 2: Qty controls — full-width row */}
              {(() => {
                const u = getUnit(item.unit)
                const allowDecimal = u.decimal
                const qtyNum = Number(item.qty) || 0
                // Step = always +1 / -1 per click (sesuai spec user) — even for
                // meter/yard, so 0,5 → 1,5 → 2,5. Manual decimal tetap bisa
                // diketik lewat QtyInput.
                const STEP = 1
                const minQty = allowDecimal ? 0.1 : 1
                return (
                  <>
                    <div
                      className="flex items-center justify-center gap-1 rounded-xl p-1 mb-2"
                      style={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          // eslint-disable-next-line no-console
                          console.log('MINUS CLICKED', { productId: item.productId, qty: qtyNum, unit: item.unit })
                          if (qtyNum <= minQty + 0.001) {
                            if (window.confirm(`Hapus "${item.name}" dari keranjang?`)) {
                              removeItem(item.productId)
                            }
                          } else {
                            updateQty(item.productId, -STEP)
                          }
                        }}
                        aria-label="Kurangi"
                        className="flex items-center justify-center btn-press flex-shrink-0"
                        style={{
                          width: 44, height: 44, minWidth: 44, minHeight: 44,
                          borderRadius: 10,
                          background: 'transparent',
                          color: 'var(--text-secondary)',
                          touchAction: 'manipulation', // iOS 300ms tap-delay killer
                          WebkitTapHighlightColor: 'transparent',
                          cursor: 'pointer',
                          userSelect: 'none',
                        }}
                      >
                        <Minus size={16} style={{ pointerEvents: 'none' }} />
                      </button>
                      <QtyInput
                        qty={qtyNum}
                        allowDecimal={allowDecimal}
                        onChange={(n) => setQtyExact(item.productId, n)}
                      />
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider px-2 flex-shrink-0"
                        style={{
                          color: 'var(--accent-light)',
                          fontFamily: 'Syne',
                          letterSpacing: '0.06em',
                          opacity: 0.85,
                          pointerEvents: 'none', // never intercept taps meant for +/-
                        }}
                      >
                        {u.label}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          // eslint-disable-next-line no-console
                          console.log('PLUS CLICKED', { productId: item.productId, qty: qtyNum, unit: item.unit })
                          updateQty(item.productId, STEP)
                        }}
                        aria-label="Tambah"
                        className="flex items-center justify-center btn-press flex-shrink-0"
                        style={{
                          width: 44, height: 44, minWidth: 44, minHeight: 44,
                          borderRadius: 10,
                          background: 'rgba(139,92,246,0.15)',
                          color: 'var(--accent-light)',
                          touchAction: 'manipulation',
                          WebkitTapHighlightColor: 'transparent',
                          cursor: 'pointer',
                          userSelect: 'none',
                        }}
                      >
                        <Plus size={16} style={{ pointerEvents: 'none' }} />
                      </button>
                    </div>

                    {/* Row 3: Subtotal — own row so price NEVER gets clipped */}
                    <div
                      className="flex items-center justify-between gap-2 px-1"
                      style={{
                        borderTop: '1px dashed var(--border)',
                        paddingTop: 8,
                      }}
                    >
                      <span
                        className="text-[10px] uppercase tracking-wider flex-shrink-0"
                        style={{
                          color: 'var(--text-muted)',
                          fontFamily: 'Syne',
                          letterSpacing: '0.08em',
                        }}
                      >
                        Subtotal · {formatQty(qtyNum, item.unit)}
                      </span>
                      <span
                        className="font-bold text-right"
                        style={{
                          fontSize: 15,
                          color: 'var(--accent-light)',
                          fontFamily: 'Syne',
                          fontVariantNumeric: 'tabular-nums',
                          whiteSpace: 'nowrap',
                          minWidth: 96,
                        }}
                      >
                        {formatRupiah(item.price * qtyNum)}
                      </span>
                    </div>
                  </>
                )
              })()}
            </div>
          ))
        )}
      </div>

      {/* Summary — sticky footer, compact spacing, safe-area aware */}
      <div
        className="px-4 py-2.5 space-y-2 flex-shrink-0"
        style={{
          borderTop: '1px solid var(--border)',
          background: 'rgba(10,10,15,0.95)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          position: 'sticky',
          bottom: 0,
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)',
          zIndex: 10,
        }}>

        {/* Discount */}
        <div className="flex items-center gap-2">
          <Tag size={13} style={{ color: 'var(--text-muted)' }} />
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Diskon</span>
          <div className="flex gap-1 ml-auto">
            <button
              onClick={() => setDiscountType('nominal')}
              className="text-xs px-2 py-0.5 rounded-lg font-semibold"
              style={{
                background: discountType === 'nominal' ? 'var(--accent)' : 'var(--bg-card)',
                color: discountType === 'nominal' ? '#fff' : 'var(--text-muted)',
                fontFamily: 'Syne',
              }}
            >
              Rp
            </button>
            <button
              onClick={() => setDiscountType('persen')}
              className="text-xs px-2 py-0.5 rounded-lg font-semibold"
              style={{
                background: discountType === 'persen' ? 'var(--accent)' : 'var(--bg-card)',
                color: discountType === 'persen' ? '#fff' : 'var(--text-muted)',
                fontFamily: 'Syne',
              }}
            >
              %
            </button>
          </div>
          <input
            type="number"
            inputMode="decimal"
            value={discount}
            onChange={(e) => {
              // Allow empty / 0 / positive; reject negatives
              const v = e.target.value
              if (v === '' || Number(v) >= 0) setDiscount(v)
            }}
            onWheel={(e) => e.target.blur()}
            placeholder={discountType === 'persen' ? 'Masukkan %' : 'Masukkan diskon'}
            className="discount-input w-28 px-2 py-1 rounded-lg text-xs text-right"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
            min={0}
          />
        </div>

        {/* Totals */}
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-muted)' }}>Subtotal</span>
            <span style={{ color: 'var(--text-secondary)' }}>{formatRupiah(subtotal)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-muted)' }}>Diskon</span>
              <span style={{ color: 'var(--red)' }}>-{formatRupiah(discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold pt-1.5 mt-1"
            style={{ borderTop: '1px dashed var(--border)' }}>
            <span style={{ color: 'var(--text-primary)', fontFamily: 'Syne' }}>Total</span>
            <span className="text-base"
              style={{ color: 'var(--accent-light)', fontFamily: 'Syne' }}>
              {formatRupiah(total)}
            </span>
          </div>
        </div>

        {/* DP */}
        <div className="flex items-center gap-2">
          <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
            DP / Bayar
          </span>
          <input
            type="number"
            inputMode="decimal"
            value={dp}
            onChange={(e) => {
              const v = e.target.value
              if (v === '' || Number(v) >= 0) setDp(v)
            }}
            onWheel={(e) => e.target.blur()}
            placeholder={`Bayar lunas: ${formatRupiah(total)}`}
            className="discount-input flex-1 px-2 py-1 rounded-lg text-xs text-right min-w-0"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
        {dpAmount > 0 && remaining > 0 && (
          <div className="flex justify-between text-xs px-2 py-1.5 rounded-lg"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Sisa</span>
            <span style={{ color: 'var(--amber)', fontWeight: 700, fontFamily: 'Syne' }}>
              {formatRupiah(remaining)}
            </span>
          </div>
        )}

        {/* Payment Method */}
        <div className="grid grid-cols-2 gap-1.5">
          {PAYMENT_METHODS.map((m) => {
            const isHutang = m.id === 'hutang'
            const active = paymentMethod === m.id
            return (
              <button
                key={m.id}
                onClick={() => setPaymentMethod(m.id)}
                className="flex flex-col items-center gap-1 py-2 rounded-xl text-xs font-medium transition-all"
                style={{
                  background: active
                    ? (isHutang ? 'rgba(245,158,11,0.15)' : 'rgba(139,92,246,0.15)')
                    : 'var(--bg-card)',
                  border: `1px solid ${active
                    ? (isHutang ? 'rgba(245,158,11,0.4)' : 'rgba(139,92,246,0.4)')
                    : 'var(--border)'}`,
                  color: active
                    ? (isHutang ? '#f59e0b' : 'var(--accent-light)')
                    : 'var(--text-muted)',
                  fontFamily: 'Syne',
                }}
              >
                <span className="text-sm">{m.icon}</span>
                {m.label}
              </button>
            )
          })}
        </div>

        {/* Hutang due-date picker — compact inline */}
        {paymentMethod === 'hutang' && (
          <div className="rounded-xl px-3 py-2 animate-fadeIn flex items-center gap-2"
            style={{
              background: 'rgba(245,158,11,0.06)',
              border: '1px solid rgba(245,158,11,0.25)',
            }}>
            <Calendar size={12} style={{ color: '#f59e0b', flexShrink: 0 }} />
            <span className="text-xs font-semibold flex-shrink-0"
              style={{ color: '#f59e0b', fontFamily: 'Syne' }}>
              Jatuh Tempo
            </span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="flex-1 min-w-0 px-2 py-1 rounded-lg text-xs"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        )}
        {paymentMethod === 'hutang' && !customerId && (
          <p className="text-xs" style={{ color: '#f59e0b' }}>
            ⚠️ Customer wajib dipilih untuk Hutang
          </p>
        )}

        {/* Buttons */}
        {checkoutError && (
          <div className="px-3 py-2 rounded-xl text-xs font-semibold animate-fadeIn"
            style={{
              background: 'rgba(255,77,106,0.08)',
              color: '#ff4d6a',
              border: '1px solid rgba(255,77,106,0.25)',
            }}>
            ⚠️ {checkoutError}
          </div>
        )}
        <div className="flex gap-2">
          <Button
            variant="primary"
            size="md"
            className="flex-1"
            onClick={handleCheckout}
            disabled={cart.length === 0 || checkingOut}
          >
            {checkingOut ? (
              <>
                <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Memproses...
              </>
            ) : (
              <>
                <Receipt size={15} />
                Checkout
              </>
            )}
          </Button>
          {cart.length > 0 && (
            <button
              onClick={() => setCart([])}
              disabled={checkingOut}
              className="px-3 py-2 rounded-xl btn-press disabled:opacity-50"
              style={{
                background: 'rgba(255,77,106,0.1)',
                color: 'var(--red)',
                border: '1px solid rgba(255,77,106,0.2)',
              }}
              title="Kosongkan keranjang"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
      {/* Product Area */}
      <div
        className="flex flex-col flex-1 overflow-hidden"
        style={{ borderRight: '1px solid var(--border)' }}
      >
        {/* Search & Filter */}
        <div
          className="px-4 sm:px-5 py-3 sm:py-4 flex flex-col gap-3 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}
        >
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari produk..."
              className="w-full pl-9 pr-9 py-2.5 rounded-xl text-sm"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X size={13} style={{ color: 'var(--text-muted)' }} />
              </button>
            )}
          </div>
          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                style={{
                  background: category === c.id
                    ? 'linear-gradient(135deg, var(--accent), #6366f1)'
                    : 'var(--bg-card)',
                  color: category === c.id ? '#fff' : 'var(--text-secondary)',
                  border: `1px solid ${category === c.id ? 'transparent' : 'var(--border)'}`,
                  fontFamily: 'Syne',
                  boxShadow: category === c.id ? '0 2px 12px rgba(139,92,246,0.3)' : 'none',
                }}
              >
                <span>{c.icon}</span> {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {filtered.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Produk tidak ditemukan"
              description="Coba ubah kata kunci atau kategori"
            />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              {filtered.map((p) => {
                const inCart = cart.find((i) => i.productId === p.id)
                return (
                  <div
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="product-card rounded-2xl overflow-hidden cursor-pointer relative"
                    style={{
                      background: 'var(--bg-card)',
                      border: `1px solid ${inCart ? 'rgba(139,92,246,0.4)' : 'var(--border)'}`,
                      cursor: 'pointer',
                    }}
                  >
                    <div className="relative aspect-square">
                      <ProductImage
                        src={p.image}
                        alt={p.name}
                        className="w-full h-full object-cover"
                        fallbackSize={80}
                      />
                      <div className="absolute inset-0 pointer-events-none"
                        style={{
                          background: 'linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.4) 100%)',
                        }} />
                      {inCart && (
                        <div
                          className="absolute top-2 right-2 min-w-6 h-6 px-1.5 rounded-full flex items-center justify-center text-xs font-bold animate-scaleIn"
                          style={{
                            background: 'linear-gradient(135deg, var(--accent), #6366f1)',
                            color: '#fff',
                            fontFamily: 'Syne',
                            boxShadow: '0 4px 12px rgba(139,92,246,0.5)',
                          }}
                        >
                          {(() => {
                            const q = Number(inCart.qty) || 0
                            const isDec = p.unit === 'meter' || p.unit === 'yard'
                            const txt = isDec
                              ? (Number.isInteger(q) ? String(q) : q.toFixed(2).replace(/\.?0+$/, '')).replace('.', ',')
                              : String(Math.round(q))
                            const suf = p.unit === 'meter' ? ' m' : p.unit === 'yard' ? ' yd' : ''
                            return `${txt}${suf}`
                          })()}
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p
                        className="text-xs font-semibold leading-tight mb-1 line-clamp-2"
                        style={{ color: 'var(--text-primary)', minHeight: 32 }}
                      >
                        {p.name}
                      </p>
                      <p
                        className="text-sm font-bold"
                        style={{ color: 'var(--accent-light)', fontFamily: 'Syne' }}
                      >
                        {formatRupiah(p.price)}
                        <span style={{
                          color: 'var(--text-muted)', fontSize: 10, fontWeight: 500, marginLeft: 4,
                        }}>
                          / {p.unit === 'meter' ? 'm' : p.unit === 'yard' ? 'yd' : 'pcs'}
                        </span>
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Desktop Cart */}
      <div className="hidden lg:flex flex-col"
        style={{ width: 340, minWidth: 320 }}>
        {cartContent}
      </div>

      {/* Mobile Cart FAB — always visible above BottomNav with safe-area */}
      <button
        onClick={() => setCartOpen(true)}
        aria-label="Buka keranjang"
        className="lg:hidden fixed right-4 z-30 flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm btn-press"
        style={{
          // Bottom offset = BottomNav height (64px) + safe-area + 16px gap
          bottom: 'calc(72px + env(safe-area-inset-bottom) + 16px)',
          background: 'linear-gradient(135deg, var(--accent), #6366f1)',
          color: '#fff',
          boxShadow: '0 8px 24px rgba(139,92,246,0.5)',
          fontFamily: 'Syne',
          minHeight: 48,
        }}
      >
        <ShoppingCart size={18} />
        Keranjang
        {cartCount > 0 && (
          <span className="bg-white text-purple-700 text-xs px-2 py-0.5 rounded-full font-bold min-w-[22px] text-center">
            {cartCount}
          </span>
        )}
      </button>

      {/* Mobile Cart Bottom Sheet */}
      {cartOpen && (
        <>
          <div className="lg:hidden fixed inset-0 z-40 drawer-overlay"
            onClick={() => setCartOpen(false)} />
          <div
            className="lg:hidden fixed left-0 right-0 bottom-0 z-50 animate-slideUp"
            style={{
              maxHeight: '85dvh',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              overflow: 'hidden',
              boxShadow: '0 -8px 32px rgba(0,0,0,0.45)',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
          >
            {/* Drag handle */}
            <div
              className="flex justify-center pt-2 pb-1"
              style={{ background: 'var(--bg-secondary)' }}
            >
              <div
                style={{
                  width: 40, height: 4, borderRadius: 4,
                  background: 'rgba(255,255,255,0.15)',
                }}
              />
            </div>
            <div style={{ height: 'calc(85dvh - 24px)', display: 'flex', flexDirection: 'column' }}>
              {cartContent}
            </div>
          </div>
        </>
      )}

      {/* Success Modal */}
      {successTrx && (
        (() => {
          const isHutangSuccess = successTrx.paymentMethod === 'hutang'
          const theme = isHutangSuccess
            ? {
                glow: 'rgba(245,158,11,0.18)',
                border: 'rgba(245,158,11,0.35)',
                iconBg: 'rgba(245,158,11,0.14)',
                iconBorder: 'rgba(245,158,11,0.45)',
                iconColor: '#f59e0b',
                totalColor: '#f59e0b',
              }
            : {
                glow: 'rgba(16,217,138,0.15)',
                border: 'rgba(16,217,138,0.3)',
                iconBg: 'rgba(16,217,138,0.12)',
                iconBorder: 'rgba(16,217,138,0.4)',
                iconColor: '#10d98a',
                totalColor: '#10d98a',
              }
          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn"
              style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
            >
              <div
                className="animate-scaleIn rounded-2xl p-6 w-full max-w-sm text-center"
                style={{
                  background: 'var(--bg-elevated)',
                  border: `1px solid ${theme.border}`,
                  boxShadow: `0 24px 80px rgba(0,0,0,0.5), 0 0 40px ${theme.glow}`,
                }}
              >
                <div className="flex justify-center mb-4">
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center animate-float"
                    style={{
                      background: theme.iconBg,
                      border: `2px solid ${theme.iconBorder}`,
                      boxShadow: `0 0 32px ${theme.glow}`,
                    }}
                  >
                    <CheckCircle2 size={36} style={{ color: theme.iconColor }} />
                  </div>
                </div>
                <h3 className="font-bold text-xl mb-1"
                  style={{ fontFamily: 'Syne', color: 'var(--text-primary)' }}>
                  Transaksi Berhasil!
                </h3>
                <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                  {successTrx.invoiceNo}
                </p>
                <p className="text-3xl font-bold mb-4"
                  style={{ fontFamily: 'Syne', color: theme.totalColor }}>
                  {formatRupiah(successTrx.total)}
                </p>
                {successTrx.remaining > 0 && (
                  <div className="mb-3 px-3 py-2 rounded-xl text-sm"
                    style={{
                      background: 'rgba(245,158,11,0.1)',
                      color: '#f59e0b',
                      border: '1px solid rgba(245,158,11,0.25)',
                    }}>
                    Sisa Pembayaran: <strong>{formatRupiah(successTrx.remaining)}</strong>
                  </div>
                )}
                {isHutangSuccess && (
                  <div className="mb-4 px-3 py-2 rounded-xl text-xs"
                    style={{
                      background: 'rgba(245,158,11,0.08)',
                      color: '#f59e0b',
                      border: '1px solid rgba(245,158,11,0.25)',
                      fontFamily: 'DM Sans',
                    }}>
                    📒 Piutang berhasil dibuat dan tercatat di menu <strong>Piutang</strong>
                  </div>
                )}

                <div className={`grid ${isHutangSuccess ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
                  <button
                    onClick={() => { setAutoShareWA(false); setShowInvoice(true) }}
                    className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-xs font-semibold btn-press"
                    style={{
                      background: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border)',
                      fontFamily: 'Syne',
                    }}
                  >
                    <Printer size={14} />
                    Print Invoice
                  </button>
                  {isHutangSuccess && (
                    <button
                      onClick={() => { setAutoShareWA(true); setShowInvoice(true) }}
                      className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-xs font-semibold btn-press"
                      style={{
                        background: 'linear-gradient(135deg, #25d366, #128c7e)',
                        color: '#fff',
                        boxShadow: '0 4px 14px rgba(37,211,102,0.3)',
                        fontFamily: 'Syne',
                      }}
                    >
                      📱 Kirim WhatsApp
                    </button>
                  )}
                  <button
                    onClick={() => { setSuccessTrx(null); setAutoShareWA(false) }}
                    className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-xs font-semibold btn-press"
                    style={{
                      background: isHutangSuccess
                        ? 'linear-gradient(135deg, #f59e0b, #ea580c)'
                        : 'linear-gradient(135deg, var(--accent), #6366f1)',
                      color: '#fff',
                      fontFamily: 'Syne',
                      boxShadow: isHutangSuccess
                        ? '0 4px 16px rgba(245,158,11,0.35)'
                        : '0 4px 16px rgba(139,92,246,0.35)',
                    }}
                  >
                    Selesai
                  </button>
                </div>
              </div>
            </div>
          )
        })()
      )}

      {/* Invoice Modal */}
      {showInvoice && successTrx && (
        <Invoice
          transaction={successTrx}
          storeInfo={storeInfo}
          autoShare={autoShareWA}
          onClose={() => { setShowInvoice(false); setAutoShareWA(false) }}
        />
      )}
    </div>
  )
}
