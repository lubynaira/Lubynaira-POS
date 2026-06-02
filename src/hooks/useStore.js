import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase, isSupabaseConfigured, uploadLogo, deleteLogo } from '../lib/supabase'
import { STORE_INFO as DEFAULT_STORE } from '../data/dummyData'

// Session persistence — keep user logged in across browser refresh.
// Uses localStorage to remember the admin id; on init, we re-fetch from
// Supabase to validate the session is still valid (admin still exists).
const SESSION_KEY = 'lubynaira_session_v2'

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveSession(user) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(user)) } catch {}
}

function clearSession() {
  try { localStorage.removeItem(SESSION_KEY) } catch {}
}

// ---------- mappers ----------

const settingsFromDB = (r) => r ? ({
  id: r.id,
  name: r.name || '',
  tagline: r.tagline || '',
  address: r.address || '',
  phone: r.phone || '',
  email: r.email || '',
  bank: { name: r.bank_name || '', number: r.bank_number || '', holder: r.bank_holder || '' },
  frontLogo: r.front_logo || '',
  invoiceLogo: r.invoice_logo || '',
  taxRate: r.tax_rate ?? 0,
}) : null

const settingsToDB = (s) => ({
  name: s.name, tagline: s.tagline, address: s.address, phone: s.phone, email: s.email,
  bank_name: s.bank?.name ?? '', bank_number: s.bank?.number ?? '', bank_holder: s.bank?.holder ?? '',
  front_logo: s.frontLogo ?? '', invoice_logo: s.invoiceLogo ?? '',
  tax_rate: s.taxRate ?? 0,
})

const adminFromDB = (r) => ({
  id: r.id, username: r.username, password: r.password,
  name: r.name || r.username, role: r.role || 'cashier',
})

const customerFromDB = (r) => ({
  id: r.id,
  name: r.name,
  phone: r.phone || '',
  whatsapp: r.whatsapp || r.phone || '',
  address: r.address || '',
  email: r.email || '',
  notes: r.notes || '',
  totalTransactions: Number(r.total_transactions) || 0,
  totalSpent: Number(r.total_spent) || 0,
  totalDebt: Number(r.total_debt) || 0,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

const customerToDB = (c) => ({
  name: c.name,
  phone: c.phone || '',
  whatsapp: c.whatsapp || '',
  address: c.address || '',
  email: c.email || '',
  notes: c.notes || '',
})

const productFromDB = (r) => ({
  id: r.id, name: r.name, category: r.category,
  price: Number(r.price) || 0, modal: Number(r.modal) || 0, stock: Number(r.stock) || 0,
  unit: (r.unit || 'pcs').toLowerCase(),
  description: r.description || '', image: r.image || '',
})

const productToDB = (p) => ({
  name: p.name, category: p.category,
  price: Number(p.price) || 0, modal: Number(p.modal) || 0, stock: Number(p.stock) || 0,
  unit: (p.unit || 'pcs').toLowerCase(),
  description: p.description || '', image: p.image || '',
})

const trxFromDB = (r) => ({
  id: r.id,
  invoiceNo: r.invoice_no,
  orderNo: r.order_no || '',
  customer: r.customer,
  customerId: r.customer_id,
  customerPhone: r.customer_phone || '',
  customerAddress: r.customer_address || '',
  items: r.items || [],
  subtotal: +r.subtotal || 0, discount: +r.discount || 0, tax: +r.tax || 0,
  total: +r.total || 0, paid: +r.paid || 0, dp: +r.dp || 0, remaining: +r.remaining || 0,
  paymentMethod: r.payment_method,
  status: r.status,
  orderStatus: r.order_status || 'menunggu',
  notes: r.notes || '',
  statusHistory: r.status_history || [],
  cashier: r.cashier || '',
  cashierRole: r.cashier_role || '',
  cashierId: r.cashier_id,
  dueDate: r.due_date || null,
  date: r.created_at,
})

const trxToDB = (t) => ({
  invoice_no: t.invoiceNo,
  order_no: t.orderNo || null,
  customer: t.customer || 'Umum',
  customer_id: t.customerId || null,
  customer_phone: t.customerPhone || '',
  customer_address: t.customerAddress || '',
  items: t.items || [],
  subtotal: +t.subtotal || 0, discount: +t.discount || 0, tax: +t.tax || 0,
  total: +t.total || 0, paid: +t.paid || 0, dp: +t.dp || 0, remaining: +t.remaining || 0,
  payment_method: t.paymentMethod || 'cash',
  status: t.status || 'pending',
  order_status: t.orderStatus || 'menunggu',
  notes: t.notes || '',
  status_history: t.statusHistory || [],
  cashier: t.cashier || '',
  cashier_id: t.cashierId || null,
  cashier_role: t.cashierRole || '',
  due_date: t.dueDate || null,
})

// Order workflow statuses (separate from payment status)
export const ORDER_WORKFLOW = [
  'menunggu',     // Just placed
  'diproses',     // Being processed
  'produksi',     // In production
  'selesai',      // Production complete
  'diambil',      // Picked up by customer
  'dikirim',      // Shipped
  'dibatalkan',   // Cancelled
]

const debtFromDB = (r) => ({
  id: r.id,
  customerId: r.customer_id,
  transactionId: r.transaction_id,
  invoiceNo: r.invoice_no,
  totalDebt: +r.total_debt || 0,
  paid: +r.paid || 0,
  remaining: +r.remaining || 0,
  dueDate: r.due_date,
  status: r.status,
  notes: r.notes || '',
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

// ---------- Hook ----------

export function useStore() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [products, setProducts] = useState([])
  const [transactions, setTransactions] = useState([])
  const [storeInfo, setStoreInfo] = useState(DEFAULT_STORE)
  const [admins, setAdmins] = useState([])
  const [customers, setCustomers] = useState([])
  const [debts, setDebts] = useState([])
  const [currentUser, setCurrentUser] = useState(() => loadSession())
  const mounted = useRef(true)

  useEffect(() => () => { mounted.current = false }, [])

  // ─── refreshAll: initial load + manual refresh ────────────────────
  // CRITICAL: tabel `transactions` punya kolom JSONB `items` yang bisa
  // sangat besar (base64 image per item × ribuan baris). SELECT * tanpa
  // batas memicu "canceling statement due to statement timeout" di
  // Supabase free/pro tier yang punya statement_timeout ~8 detik.
  // Solusi: batasi ke 500 transaksi terakhir + 500 debt terakhir untuk
  // initial paint dashboard. Detail tetap bisa diambil via fetch lazy.
  const TRX_LIMIT = 500
  const DEBT_LIMIT = 500

  const refreshAll = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [s, a, p, t, c, d] = await Promise.all([
        supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
        supabase.from('admins').select('*').order('created_at', { ascending: true }),
        supabase.from('products').select('*').order('created_at', { ascending: false }),
        // Limit transactions + debts agar query selalu cepat
        supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(TRX_LIMIT),
        supabase.from('customers').select('*').order('created_at', { ascending: false }),
        supabase.from('debts').select('*').order('created_at', { ascending: false }).limit(DEBT_LIMIT),
      ])
      for (const r of [s, a, p, t, c, d]) if (r.error) throw r.error
      if (!mounted.current) return
      setStoreInfo(settingsFromDB(s.data) || DEFAULT_STORE)
      const allAdmins = (a.data || []).map(adminFromDB)
      setAdmins(allAdmins)
      // Validate restored session: if user no longer exists, clear it
      const restored = loadSession()
      if (restored?.id && !allAdmins.find(x => x.id === restored.id)) {
        clearSession()
        if (mounted.current) setCurrentUser(null)
      }
      setProducts((p.data || []).map(productFromDB))
      const trxList = (t.data || []).map(trxFromDB)
      setTransactions(trxList)
      setCustomers((c.data || []).map(customerFromDB))
      setDebts((d.data || []).map(debtFromDB))

      // NOTE: Legacy "auto-fix stale=lunas" sync DIHAPUS karena bisa
      // mem-issue UPDATE bulk ke ratusan baris saat startup → potensi
      // statement timeout. Sinkronisasi sekarang dikerjakan oleh
      // syncDebtPaymentStatus per invoice saat aksi user terjadi.
    } catch (e) {
      if (mounted.current) setError(
        isSupabaseConfigured
          ? `Gagal terhubung ke Supabase: ${e.message || e}`
          : 'Supabase belum dikonfigurasi. Buat file .env dari .env.example.'
      )
    } finally {
      if (mounted.current) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { refreshAll() }, [refreshAll])

  // Refresher helpers — semua dibatasi LIMIT supaya tidak pernah timeout.
  const refreshCustomers = useCallback(async () => {
    const { data, error: e } = await supabase
      .from('customers').select('*')
      .order('created_at', { ascending: false })
      .limit(1000)
    if (!e && mounted.current) setCustomers((data || []).map(customerFromDB))
  }, [])

  const refreshDebts = useCallback(async () => {
    const { data, error: e } = await supabase
      .from('debts').select('*')
      .order('created_at', { ascending: false })
      .limit(500)
    if (!e && mounted.current) setDebts((data || []).map(debtFromDB))
  }, [])

  const refreshTransactions = useCallback(async () => {
    const { data, error: e } = await supabase
      .from('transactions').select('*')
      .order('created_at', { ascending: false })
      .limit(500)
    if (!e && mounted.current) setTransactions((data || []).map(trxFromDB))
  }, [])

  // ─── Realtime subscriptions ───────────────────────────────────────
  // Satu channel, satu subscription. Setiap perubahan dipush ke handler
  // yang DI-DEBOUNCE: kalau payDebt mengupdate 4 tabel dalam 100ms, kita
  // hanya issue 1 batch refresh setelah 500ms idle — bukan 4 round-trip
  // berturut-turut yang bisa memicu statement timeout cascade.
  useEffect(() => {
    if (!isSupabaseConfigured) return

    // Debounce: queue tabel mana yang perlu di-refresh, fire sekali.
    const queue = new Set()
    let timer = null
    const flush = () => {
      timer = null
      const tables = [...queue]
      queue.clear()
      if (tables.includes('transactions')) refreshTransactions()
      if (tables.includes('debts'))         refreshDebts()
      if (tables.includes('customers'))     refreshCustomers()
      if (tables.includes('products')) {
        // products jarang berubah; pakai inline query supaya tidak
        // butuh helper terpisah, dan tetap di-LIMIT.
        supabase.from('products').select('*')
          .order('created_at', { ascending: false }).limit(500)
          .then(({ data }) => {
            if (mounted.current && data) setProducts(data.map(productFromDB))
          })
      }
    }
    const schedule = (...names) => {
      names.forEach(n => queue.add(n))
      if (timer) clearTimeout(timer)
      timer = setTimeout(flush, 500)  // 500ms debounce window
    }

    const channel = supabase.channel('luby-naira-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' },
        () => schedule('transactions'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'debts' },
        () => schedule('debts'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'debt_payments' },
        () => schedule('debts', 'transactions', 'customers'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' },
        () => schedule('customers'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' },
        () => schedule('products'))
      .subscribe()

    return () => {
      if (timer) clearTimeout(timer)
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const wrap = useCallback(async (fn) => {
    setBusy(true)
    try { return await fn() }
    finally { if (mounted.current) setBusy(false) }
  }, [])

  // ---------- AUTH ----------
  const login = useCallback(async (username, password) => wrap(async () => {
    const u = (username || '').trim().toLowerCase()
    if (!u || !password) return { ok: false, error: 'Username & password wajib diisi' }
    const { data, error: e } = await supabase
      .from('admins').select('*').eq('username', u).eq('password', password).maybeSingle()
    if (e) return { ok: false, error: e.message }
    if (!data) return { ok: false, error: 'Username atau password salah' }
    const user = { id: data.id, username: data.username, name: data.name || data.username, role: data.role }
    setCurrentUser(user)
    saveSession(user)
    return { ok: true }
  }), [wrap])

  const logout = useCallback(() => {
    setCurrentUser(null)
    clearSession()
  }, [])

  // ---------- SETTINGS ----------
  const updateStoreInfo = useCallback(async (partial) => wrap(async () => {
    const next = { ...storeInfo, ...partial }
    const { error: e } = await supabase.from('settings').upsert({ id: 1, ...settingsToDB(next) })
    if (e) return { ok: false, error: e.message }
    if (mounted.current) setStoreInfo(next)
    return { ok: true }
  }), [storeInfo, wrap])

  const updateLogo = useCallback(async (logoType, fileOrEmpty) => wrap(async () => {
    try {
      if (!fileOrEmpty) {
        const oldUrl = storeInfo?.[logoType]
        const next = { ...storeInfo, [logoType]: '' }
        const { error: e } = await supabase.from('settings').upsert({ id: 1, ...settingsToDB(next) })
        if (e) return { ok: false, error: e.message }
        if (oldUrl) { try { await deleteLogo(oldUrl) } catch {} }
        if (mounted.current) setStoreInfo(next)
        return { ok: true }
      }
      const url = await uploadLogo(fileOrEmpty, logoType)
      const next = { ...storeInfo, [logoType]: url }
      const { error: e } = await supabase.from('settings').upsert({ id: 1, ...settingsToDB(next) })
      if (e) return { ok: false, error: e.message }
      if (mounted.current) setStoreInfo(next)
      return { ok: true }
    } catch (err) { return { ok: false, error: err.message || String(err) } }
  }), [storeInfo, wrap])

  // ---------- ADMINS ----------
  const addAdmin = useCallback(async (data) => wrap(async () => {
    const u = (data.username || '').trim().toLowerCase()
    if (!u) return { ok: false, error: 'Username wajib diisi' }
    if (!data.password || data.password.length < 4) return { ok: false, error: 'Password minimal 4 karakter' }
    const { data: inserted, error: e } = await supabase.from('admins')
      .insert({ username: u, password: data.password, name: data.name || u, role: data.role || 'cashier' })
      .select().single()
    if (e) {
      if (String(e.message).includes('duplicate')) return { ok: false, error: 'Username sudah dipakai' }
      return { ok: false, error: e.message }
    }
    if (mounted.current) setAdmins(prev => [...prev, adminFromDB(inserted)])
    return { ok: true }
  }), [wrap])

  const deleteAdmin = useCallback(async (id) => wrap(async () => {
    if (admins.length <= 1) return { ok: false, error: 'Minimal harus ada 1 admin' }
    if (currentUser?.id === id) return { ok: false, error: 'Tidak bisa menghapus diri sendiri' }
    const { error: e } = await supabase.from('admins').delete().eq('id', id)
    if (e) return { ok: false, error: e.message }
    if (mounted.current) setAdmins(prev => prev.filter(a => a.id !== id))
    return { ok: true }
  }), [admins, currentUser, wrap])

  const changePassword = useCallback(async (oldPass, newPass) => wrap(async () => {
    if (!currentUser) return { ok: false, error: 'Belum login' }
    if (!newPass || newPass.length < 4) return { ok: false, error: 'Password baru minimal 4 karakter' }
    const { data: me, error: e1 } = await supabase.from('admins').select('id, password').eq('id', currentUser.id).single()
    if (e1) return { ok: false, error: e1.message }
    if (me.password !== oldPass) return { ok: false, error: 'Password lama salah' }
    const { error: e2 } = await supabase.from('admins').update({ password: newPass }).eq('id', currentUser.id)
    if (e2) return { ok: false, error: e2.message }
    if (mounted.current) setAdmins(prev => prev.map(a => a.id === currentUser.id ? { ...a, password: newPass } : a))
    return { ok: true }
  }), [currentUser, wrap])

  // ---------- CUSTOMERS ----------
  const addCustomer = useCallback(async (data) => wrap(async () => {
    if (!data.name?.trim()) return { ok: false, error: 'Nama wajib diisi' }
    const { data: row, error: e } = await supabase.from('customers').insert(customerToDB(data)).select().single()
    if (e) return { ok: false, error: e.message }
    if (mounted.current) setCustomers(prev => [customerFromDB(row), ...prev])
    return { ok: true, data: customerFromDB(row) }
  }), [wrap])

  const updateCustomer = useCallback(async (id, data) => wrap(async () => {
    const { data: row, error: e } = await supabase.from('customers').update(customerToDB(data)).eq('id', id).select().single()
    if (e) return { ok: false, error: e.message }
    if (mounted.current) setCustomers(prev => prev.map(c => c.id === id ? customerFromDB(row) : c))
    return { ok: true }
  }), [wrap])

  const deleteCustomer = useCallback(async (id) => wrap(async () => {
    const { error: e } = await supabase.from('customers').delete().eq('id', id)
    if (e) return { ok: false, error: e.message }
    if (mounted.current) setCustomers(prev => prev.filter(c => c.id !== id))
    return { ok: true }
  }), [wrap])

  // ---------- PRODUCTS ----------
  // Detect "missing column" errors from PostgREST (Supabase REST API)
  // so we can retry with a stripped payload when the DB migration
  // hasn't been applied yet. Without this, an outdated schema would
  // crash all product CRUD with "Could not find the 'unit' column".
  const isSchemaCacheError = (err, col) => {
    if (!err) return false
    const msg = String(err.message || err.error_description || '').toLowerCase()
    const code = String(err.code || '')
    return (
      code === 'PGRST204' ||
      msg.includes(`'${col}' column`) ||
      msg.includes(`column "${col}"`) ||
      msg.includes(`could not find the '${col}'`) ||
      msg.includes('schema cache')
    )
  }
  // Drop one or more keys and return a new object
  const omit = (obj, keys) => {
    const out = { ...obj }
    for (const k of keys) delete out[k]
    return out
  }

  const addProduct = useCallback(async (data) => wrap(async () => {
    const payload = productToDB(data)
    let { data: row, error: e } = await supabase
      .from('products').insert(payload).select().single()
    // Fallback: DB may be missing `unit` column (migration not yet run).
    if (e && isSchemaCacheError(e, 'unit')) {
      // eslint-disable-next-line no-console
      console.warn('[Luby Naira POS] DB belum punya kolom products.unit — produk akan disimpan tanpa unit. Jalankan migrasi supabase/migrations/2026_06_add_unit_to_products.sql.')
      const retry = await supabase
        .from('products').insert(omit(payload, ['unit'])).select().single()
      row = retry.data; e = retry.error
    }
    if (e) return { ok: false, error: e.message }
    if (mounted.current) setProducts(prev => [productFromDB(row), ...prev])
    return { ok: true }
  }), [wrap])

  const updateProduct = useCallback(async (id, data) => wrap(async () => {
    const payload = productToDB(data)
    let { data: row, error: e } = await supabase
      .from('products').update(payload).eq('id', id).select().single()
    if (e && isSchemaCacheError(e, 'unit')) {
      // eslint-disable-next-line no-console
      console.warn('[Luby Naira POS] DB belum punya kolom products.unit — produk akan disimpan tanpa unit. Jalankan migrasi supabase/migrations/2026_06_add_unit_to_products.sql.')
      const retry = await supabase
        .from('products').update(omit(payload, ['unit'])).eq('id', id).select().single()
      row = retry.data; e = retry.error
    }
    if (e) return { ok: false, error: e.message }
    if (mounted.current) setProducts(prev => prev.map(p => p.id === id ? productFromDB(row) : p))
    return { ok: true }
  }), [wrap])

  const deleteProduct = useCallback(async (id) => wrap(async () => {
    const { error: e } = await supabase.from('products').delete().eq('id', id)
    if (e) return { ok: false, error: e.message }
    if (mounted.current) setProducts(prev => prev.filter(p => p.id !== id))
    return { ok: true }
  }), [wrap])

  // ---------- TRANSACTIONS ----------
  // Format invoice baru: TIMESTAMP + RANDOM SUFFIX
  //   invoice_no : INV-YYYYMMDD-HHMMSS-XXX  → INV-20260601-151923-482
  //   order_no   : ORD-YYYYMMDD-HHMMSS-XXX  → ORD-20260601-151923-482
  // Kenapa diganti dari format harian (DDMMYYYY-001):
  //   • Format harian rentan tabrakan kalau ada baris yang dihapus atau
  //     dua kasir checkout bersamaan (lihat error 23505 yang muncul user).
  //   • Format timestamp + random 3-digit secara praktis collision-proof:
  //     harus DUA checkout di detik yang sama AND random sama (1/1000).
  //   • Tetap human-readable dan terurut secara alami.
  // Generator dipanggil tepat saat checkout (lihat addTransaction);
  // tidak ada generate "early" saat halaman Kasir dibuka.
  const generateInvoiceNumber = useCallback(() => {
    const d = new Date()
    const y = d.getFullYear()
    const mo = String(d.getMonth() + 1).padStart(2, '0')
    const da = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mi = String(d.getMinutes()).padStart(2, '0')
    const ss = String(d.getSeconds()).padStart(2, '0')
    const rand = String(Math.floor(Math.random() * 1000)).padStart(3, '0')
    return `INV-${y}${mo}${da}-${hh}${mi}${ss}-${rand}`
  }, [])

  const generateOrderNumber = useCallback(() => {
    const d = new Date()
    const y = d.getFullYear()
    const mo = String(d.getMonth() + 1).padStart(2, '0')
    const da = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mi = String(d.getMinutes()).padStart(2, '0')
    const ss = String(d.getSeconds()).padStart(2, '0')
    const rand = String(Math.floor(Math.random() * 1000)).padStart(3, '0')
    return `ORD-${y}${mo}${da}-${hh}${mi}${ss}-${rand}`
  }, [])

  // Compat: nama lama dipertahankan supaya callers (di addTransaction
  // dan elsewhere) tidak perlu diubah massal. Keduanya sekarang sync.
  const nextInvoiceNumber = useCallback(async () => generateInvoiceNumber(), [generateInvoiceNumber])
  const nextOrderNumber   = useCallback(async () => generateOrderNumber(),   [generateOrderNumber])

  // Detect Postgres UNIQUE violation (code 23505) so we know to regenerate
  // the invoice number and retry. Supabase forwards the code on err.code,
  // and the message typically includes "duplicate key value violates unique".
  const isUniqueViolation = (err) => {
    if (!err) return false
    if (err.code === '23505') return true
    const msg = String(err.message || '').toLowerCase()
    return msg.includes('duplicate key') || msg.includes('unique constraint')
  }

  // ---------- CUSTOMER RECALCULATION ----------
  // Hitung ulang total_transactions, total_spent, dan total_debt dari tabel
  // transactions + debts. Dipanggil setelah checkout / payDebt / delete agar
  // tidak ada drift antar tabel (trigger DB hanya menambah saat INSERT, tidak
  // mengurangi saat DELETE).
  const recalculateCustomerSummary = useCallback(async (customerId) => {
    if (!customerId) return
    try {
      const [trxRes, debtRes] = await Promise.all([
        supabase.from('transactions')
          .select('total, remaining, status')
          .eq('customer_id', customerId),
        supabase.from('debts')
          .select('remaining, status')
          .eq('customer_id', customerId)
          .eq('status', 'aktif'),
      ])
      const trxs = trxRes.data || []
      const activeDebts = debtRes.data || []
      const totalTransactions = trxs.length
      const totalSpent = trxs.reduce((s, t) => s + (+t.total || 0), 0)
      const totalDebt = activeDebts.reduce((s, d) => s + (+d.remaining || 0), 0)
      const { error: e } = await supabase
        .from('customers')
        .update({
          total_transactions: totalTransactions,
          total_spent: totalSpent,
          total_debt: totalDebt,
        })
        .eq('id', customerId)
      if (e) {
        // eslint-disable-next-line no-console
        console.warn('[useStore] recalculateCustomerSummary update gagal:', e)
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[useStore] recalculateCustomerSummary error:', err)
    }
  }, [])

  const addTransaction = useCallback(async (trx) => wrap(async () => {
    try {
      const cashier = currentUser?.name || currentUser?.username || ''
      const cashierId = currentUser?.id || null
      const cashierRole = currentUser?.role || 'cashier'
      const nowIso = new Date().toISOString()
      const statusHistory = [{
        order_status: trx.orderStatus || 'menunggu',
        changed_at: nowIso,
        changed_by: cashier || 'system',
      }]

      // ─── RETRY LOOP — handle duplicate invoice_no (race / gap / etc.) ───
      // Penyebab bentrok:
      //   1. Dua kasir checkout bersamaan, COUNT/MAX query keduanya balik
      //      angka sama → keduanya generate nomor yang sama.
      //   2. Invoice lama dengan nomor yang sama belum sempat tersinkron.
      //   3. Race condition antara generate dan insert.
      // Solusi: loop sampai 5x, generate ulang nomor dari MAX, lalu retry.
      const MAX_ATTEMPTS = 5
      let row = null, e = null, invoiceNo = '', orderNo = ''
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        // Fresh number each attempt (MAX query melihat baris yang baru saja
        // disisip oleh kasir lain juga, jadi attempt ke-2 akan mendapat
        // nomor yang sudah berbeda dari attempt ke-1).
        ;[invoiceNo, orderNo] = await Promise.all([
          nextInvoiceNumber(),
          nextOrderNumber(),
        ])
        const payload = trxToDB({
          ...trx,
          invoiceNo, orderNo,
          cashier, cashierId, cashierRole,
          statusHistory,
          orderStatus: trx.orderStatus || 'menunggu',
        })
        // eslint-disable-next-line no-console
        console.log(`[useStore] Inserting transaction (attempt ${attempt}/${MAX_ATTEMPTS}):`, invoiceNo)
        let res = await supabase.from('transactions').insert(payload).select().single()
        // Defensive retry kalau DB belum punya kolom due_date / cashier_role.
        if (res.error && isSchemaCacheError(res.error, 'due_date')) {
          // eslint-disable-next-line no-console
          console.warn('[useStore] DB belum punya kolom transactions.due_date — transaksi disimpan tanpa due_date.')
          res = await supabase
            .from('transactions').insert(omit(payload, ['due_date'])).select().single()
        }
        if (res.error && isSchemaCacheError(res.error, 'cashier_role')) {
          // eslint-disable-next-line no-console
          console.warn('[useStore] DB belum punya kolom transactions.cashier_role — transaksi disimpan tanpa role.')
          res = await supabase
            .from('transactions').insert(omit(payload, ['cashier_role'])).select().single()
        }
        row = res.data
        e = res.error
        if (!e) break // success
        if (isUniqueViolation(e)) {
          // eslint-disable-next-line no-console
          console.warn(`[useStore] Nomor invoice ${invoiceNo} sudah dipakai, generate ulang (attempt ${attempt}/${MAX_ATTEMPTS})…`)
          // Short backoff so concurrent inserts don't keep stepping on each other
          await new Promise(r => setTimeout(r, 60 + attempt * 40))
          continue
        }
        // Non-recoverable error — break out so the user sees the real message
        break
      }
      if (e) {
        // eslint-disable-next-line no-console
        console.error('[useStore] Gagal insert transaksi (semua percobaan habis):', e)
        // Translate raw DB error → user-friendly Indonesian
        const friendly = isUniqueViolation(e)
          ? 'Nomor invoice sedang sibuk digunakan kasir lain. Coba checkout sekali lagi.'
          : `Gagal menyimpan transaksi: ${e.message}`
        return { ok: false, error: friendly }
      }

      // Decrement stock
      await Promise.all(trx.items.map(async (item) => {
        const p = products.find(x => x.id === item.productId)
        if (!p) return
        await supabase.from('products').update({ stock: Math.max(0, p.stock - item.qty) }).eq('id', item.productId)
      }))

      // If "Hutang", create a debt row
      if (trx.paymentMethod === 'hutang' && trx.customerId) {
        // ✱ DEBT MIRROR-OF-TRANSACTION ✱
        // debt.total_debt   = transactions.total        (full total tagihan)
        // debt.paid         = transactions.paid         (sudah include DP)
        // debt.remaining    = transactions.remaining    (total - paid)
        // Sebelumnya debt.paid disimpan 0 + total_debt = sisa-setelah-DP →
        // saat processDebtPayment menulis paidAfter ke transactions, DP
        // hilang (terpotong dobel). Sekarang kedua tabel selalu mirror.
        const totalFinal = +trx.total || 0
        const dpAmt = +trx.paid || +trx.dp || 0
        const remainingAmt = Math.max(0, totalFinal - dpAmt)
        const debtPayload = {
          customer_id: trx.customerId,
          transaction_id: row.id,
          invoice_no: invoiceNo,
          total_debt: totalFinal,
          paid: dpAmt,
          remaining: remainingAmt,
          due_date: trx.dueDate || null,
          status: remainingAmt <= 0 ? 'lunas' : 'aktif',
          notes: trx.notes || '',
        }
        const { error: debtErr } = await supabase.from('debts').insert(debtPayload)
        if (debtErr) {
          // eslint-disable-next-line no-console
          console.error('[useStore] Gagal membuat hutang:', debtErr, debtPayload)
          return { ok: false, error: `Transaksi tersimpan, tapi data hutang gagal disimpan: ${debtErr.message}` }
        }
        await refreshDebts()
      }

      const newTrx = trxFromDB(row)
      if (mounted.current) {
        setTransactions(prev => [newTrx, ...prev])
        setProducts(prev => prev.map(p => {
          const it = trx.items.find(i => i.productId === p.id)
          if (!it) return p
          return { ...p, stock: Math.max(0, p.stock - it.qty) }
        }))
      }
      // Refresh customer stats — use recalculate to keep numbers honest
      // (the INSERT trigger only adds; we want canonical values).
      if (trx.customerId) {
        await recalculateCustomerSummary(trx.customerId)
        await refreshCustomers()
      }
      return { ok: true, data: newTrx }
    } catch (err) { return { ok: false, error: err.message || String(err) } }
  }), [products, currentUser, wrap, nextInvoiceNumber, nextOrderNumber, refreshCustomers, refreshDebts, recalculateCustomerSummary])

  // ---------- SYNC DEBT ↔ TRANSACTION ↔ CUSTOMER ----------
  // syncDebtPaymentStatus(invoiceNo)
  // ------------------------------------------------------------
  // Single source of truth untuk konsistensi 4 tabel berdasarkan invoice_no.
  // Dipanggil setelah:
  //   • Order ditandai Lunas dari halaman Order (updateTransactionStatus)
  //   • Pembayaran sebagian dari halaman Order (updateTransactionPayment)
  //   • Pembayaran hutang dari halaman Piutang (payDebt)
  // Cara kerja:
  //   1. Cari transaction berdasarkan invoice_no
  //   2. Cari debt berdasarkan invoice_no atau transaction_id
  //   3. SUM debt_payments untuk debt tersebut
  //   4. Update paid + remaining + status di debts
  //   5. Update paid + remaining + status di transactions
  //   6. Recalc customers.total_debt
  // Idempotent — aman dipanggil berkali-kali untuk invoice yang sama.
  const syncDebtPaymentStatus = useCallback(async (invoiceNo) => {
    if (!invoiceNo) return { ok: false, error: 'invoice_no kosong' }
    try {
      // 1. Transaction by invoice_no
      const { data: trx, error: trxErr } = await supabase
        .from('transactions')
        .select('id, invoice_no, customer_id, total, paid, remaining, status')
        .eq('invoice_no', invoiceNo)
        .maybeSingle()
      if (trxErr || !trx) {
        return { ok: false, error: trxErr?.message || 'Transaksi tidak ditemukan' }
      }
      const totalAmt = +trx.total || 0

      // 2. Debt by invoice_no OR transaction_id (whichever matches first)
      let { data: debt } = await supabase
        .from('debts')
        .select('*')
        .eq('invoice_no', invoiceNo)
        .maybeSingle()
      if (!debt) {
        const byTrx = await supabase
          .from('debts').select('*').eq('transaction_id', trx.id).maybeSingle()
        debt = byTrx.data
      }

      let newPaid, newRemaining, newStatus
      if (debt) {
        // 3. SUM debt_payments → authoritative source of paid
        const { data: payments } = await supabase
          .from('debt_payments').select('amount').eq('debt_id', debt.id)
        const paidFromHistory = (payments || []).reduce((s, p) => s + (+p.amount || 0), 0)
        // If trx.paid is higher (e.g. user marked Lunas manually from Order
        // without going through payDebt), take the larger number — that
        // represents the actual settled amount.
        newPaid = Math.max(paidFromHistory, +trx.paid || 0)
        newRemaining = Math.max(0, totalAmt - newPaid)
        newStatus = newRemaining <= 0 ? 'lunas' : 'aktif'

        // 4. Update debts
        await supabase.from('debts').update({
          paid: newPaid,
          remaining: newRemaining,
          status: newStatus,
        }).eq('id', debt.id)
      } else {
        // No debt row — purely cash/transfer/qris transaction
        newPaid = +trx.paid || 0
        newRemaining = Math.max(0, totalAmt - newPaid)
        newStatus = newRemaining <= 0 ? 'lunas' : 'pending'
      }

      // 5. Update transactions (always — payment status reflects in Order)
      const trxStatus = newRemaining <= 0 ? 'lunas' : 'pending'
      await supabase.from('transactions').update({
        paid: newPaid,
        dp: newPaid,
        remaining: newRemaining,
        status: trxStatus,
      }).eq('id', trx.id)

      // 6. Recalc customer summary
      if (trx.customer_id) {
        await recalculateCustomerSummary(trx.customer_id)
      }

      return { ok: true, data: { paid: newPaid, remaining: newRemaining, status: trxStatus } }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[useStore] syncDebtPaymentStatus error:', err)
      return { ok: false, error: err.message || String(err) }
    }
  }, [recalculateCustomerSummary])

  const updateOrderStatus = useCallback(async (id, newStatus) => wrap(async () => {
    const current = transactions.find(t => t.id === id)
    if (!current) return { ok: false, error: 'Transaksi tidak ditemukan' }
    const cashier = currentUser?.name || currentUser?.username || 'system'
    const newHistory = [
      ...(current.statusHistory || []),
      {
        order_status: newStatus,
        changed_at: new Date().toISOString(),
        changed_by: cashier,
        from: current.orderStatus || 'menunggu',
      },
    ]
    const { data: row, error: e } = await supabase
      .from('transactions')
      .update({ order_status: newStatus, status_history: newHistory })
      .eq('id', id).select().single()
    if (e) return { ok: false, error: e.message }
    if (mounted.current) setTransactions(prev => prev.map(t => t.id === id ? trxFromDB(row) : t))
    return { ok: true }
  }), [transactions, currentUser, wrap])

  const updateTransactionStatus = useCallback(async (id, status) => wrap(async () => {
    const current = transactions.find(t => t.id === id)
    if (!current) return { ok: false, error: 'Transaksi tidak ditemukan' }
    const updates = { status }
    if (status === 'lunas') { updates.paid = current.total; updates.dp = current.total; updates.remaining = 0 }
    const { data: row, error: e } = await supabase.from('transactions').update(updates).eq('id', id).select().single()
    if (e) return { ok: false, error: e.message }
    // ─── Sync the linked debt + customer summary if this trx has hutang ───
    // If user marked Lunas from Order, the debt row must mirror that.
    if (current.invoiceNo) {
      const syncResult = await syncDebtPaymentStatus(current.invoiceNo)
      if (!syncResult.ok) {
        // eslint-disable-next-line no-console
        console.warn('[useStore] sync debt after status change gagal:', syncResult.error)
      }
    }
    if (mounted.current) setTransactions(prev => prev.map(t => t.id === id ? trxFromDB(row) : t))
    // Refresh debts + customers so Piutang page + Dashboard pick up the change
    await Promise.all([refreshDebts(), refreshCustomers()])
    return { ok: true }
  }), [transactions, wrap, syncDebtPaymentStatus, refreshDebts, refreshCustomers])

  // ═══════════════════════════════════════════════════════════════════
  // processDebtPayment(opts) — CANONICAL helper untuk pembayaran hutang.
  // Dipakai oleh BOTH:
  //   • Halaman Order (tombol "Tambah Pembayaran")
  //   • Halaman Piutang (tombol "Bayar Cicilan")
  //
  // Rumus (sumber kebenaran tunggal — TIDAK pakai total - paidAfter):
  //   remainingBefore = debt.remaining  ?? transaction.remaining
  //   paidBefore      = debt.paid       ?? transaction.paid
  //   paidAfter       = paidBefore + paymentAmount
  //   remainingAfter  = max(0, remainingBefore - paymentAmount)
  //
  // Wajib update bersamaan:
  //   transactions { paid, dp, remaining, status='lunas'/'pending' }
  //   debts        { paid, remaining, status='lunas'/'aktif' }
  //   debt_payments INSERT history row
  //   customers    { total_debt = SUM(debts.remaining WHERE aktif) }
  //
  // Lalu refresh state lokal supaya Order, Piutang, Customers, Dashboard
  // langsung sinkron tanpa menunggu echo realtime.
  // ═══════════════════════════════════════════════════════════════════
  const processDebtPayment = useCallback(async ({
    invoice_no,
    paymentAmount,
    paymentMethod = 'cash',
    notes = '',
  }) => wrap(async () => {
    const amount = Number(paymentAmount) || 0
    if (amount <= 0) return { ok: false, error: 'Nominal pembayaran harus lebih dari 0' }
    if (!invoice_no) return { ok: false, error: 'invoice_no kosong' }

    // 1. Fetch transaction by invoice_no
    const { data: trxRow, error: trxErr } = await supabase
      .from('transactions')
      .select('id, invoice_no, customer_id, total, paid, remaining, status, dp')
      .eq('invoice_no', invoice_no)
      .maybeSingle()
    if (trxErr || !trxRow) {
      return { ok: false, error: trxErr?.message || 'Transaksi tidak ditemukan' }
    }

    // 2. Fetch debt by invoice_no, fallback ke transaction_id
    let { data: debtRow } = await supabase
      .from('debts').select('*')
      .eq('invoice_no', invoice_no).maybeSingle()
    if (!debtRow) {
      const byTrx = await supabase.from('debts').select('*')
        .eq('transaction_id', trxRow.id).maybeSingle()
      debtRow = byTrx.data
    }

    // 3-6. Tentukan remainingBefore + paidBefore
    // PRIORITAS: TRANSACTIONS (karena selalu include DP awal). Fallback ke
    // debt kalau transaction.paid masih 0 untuk row legacy.
    const total = Number(trxRow.total) || 0
    const paidBefore = (Number(trxRow.paid) || 0) > 0
      ? Number(trxRow.paid)
      : (debtRow && Number(debtRow.paid) ? Number(debtRow.paid) : 0)
    const remainingBefore = Math.max(0, total - paidBefore)

    // 7. Hitung — kurangkan dari remainingBefore (BUKAN dari total - paidAfter
    //    yang bisa salah kalau ada drift)
    const paidAfter = paidBefore + amount
    let remainingAfter = remainingBefore - amount
    if (remainingAfter < 0) remainingAfter = 0

    // 8. Validasi paymentAmount <= remainingBefore
    if (amount > remainingBefore) {
      return { ok: false, error: 'Nominal pembayaran melebihi sisa tagihan' }
    }

    // 9. Update transactions
    const trxStatus = remainingAfter <= 0 ? 'lunas' : 'pending'
    const { error: trxUpdErr } = await supabase
      .from('transactions')
      .update({
        paid: paidAfter,
        dp: paidAfter,
        remaining: remainingAfter,
        status: trxStatus,
      })
      .eq('id', trxRow.id)
    if (trxUpdErr) {
      // eslint-disable-next-line no-console
      console.error('[processDebtPayment] gagal update transactions:', trxUpdErr)
    }

    // 10. Update debts (kalau ada row debts)
    const debtStatus = remainingAfter <= 0 ? 'lunas' : 'aktif'
    if (debtRow) {
      const { error: debtUpdErr } = await supabase
        .from('debts')
        .update({
          paid: paidAfter,
          remaining: remainingAfter,
          status: debtStatus,
        })
        .eq('id', debtRow.id)
      if (debtUpdErr) {
        // eslint-disable-next-line no-console
        console.error('[processDebtPayment] gagal update debts:', debtUpdErr)
      }
    }

    // 11. Insert debt_payments history
    const cashier = currentUser?.name || currentUser?.username || ''
    const cashierId = currentUser?.id || null
    const payPayload = {
      debt_id: debtRow?.id || null,
      amount,
      payment_method: paymentMethod,
      notes,
      cashier,
      cashier_id: cashierId,
      invoice_no,
      paid_at: new Date().toISOString(),
    }
    let { error: payErr } = await supabase.from('debt_payments').insert(payPayload)
    if (payErr && isSchemaCacheError(payErr, 'invoice_no')) {
      // Legacy schema tanpa kolom invoice_no di debt_payments
      const retry = await supabase.from('debt_payments').insert(omit(payPayload, ['invoice_no']))
      payErr = retry.error
    }
    if (payErr) {
      // eslint-disable-next-line no-console
      console.error('[processDebtPayment] gagal insert debt_payments:', payErr)
      // Tidak return error — UPDATE sudah berhasil; history boleh gagal silent.
    }

    // 12. Recalculate customers.total_debt
    const custId = trxRow.customer_id || debtRow?.customer_id || null
    if (custId) {
      await recalculateCustomerSummary(custId)
    }

    // 13. Refresh state lokal: Order + Piutang + Customers
    await Promise.all([refreshTransactions(), refreshDebts(), refreshCustomers()])

    return {
      ok: true,
      data: { paidAfter, remainingAfter, status: trxStatus, remainingBefore, paidBefore },
    }
  }), [wrap, currentUser, refreshTransactions, refreshDebts, refreshCustomers, recalculateCustomerSummary])

  // updateTransactionPayment (Order) — DELEGATE ke processDebtPayment.
  // Tidak ada wrap() outer karena processDebtPayment sudah pakai wrap sendiri.
  // Signature lama dipertahankan untuk backward compat: (id, addPayment).
  const updateTransactionPayment = useCallback(async (id, addPayment) => {
    const current = transactions.find(t => t.id === id)
    if (!current) return { ok: false, error: 'Transaksi tidak ditemukan' }
    const amount = Number(addPayment) || 0
    if (amount <= 0) return { ok: false, error: 'Nominal harus > 0' }
    if (!current.invoiceNo) return { ok: false, error: 'invoice_no kosong' }
    return await processDebtPayment({
      invoice_no: current.invoiceNo,
      paymentAmount: amount,
      paymentMethod: 'cash',
      notes: 'Pembayaran dari halaman Order',
    })
  }, [transactions, processDebtPayment])

  const deleteTransaction = useCallback(async (id) => wrap(async () => {
    // Capture customerId BEFORE deleting so we can recalc afterwards.
    const trx = transactions.find(t => t.id === id)
    const customerId = trx?.customerId || null
    // FK CASCADE on debts.transaction_id + debt_payments.debt_id (set up in
    // the migration) ensures related rows die alongside this row.
    const { error: e } = await supabase.from('transactions').delete().eq('id', id)
    if (e) return { ok: false, error: e.message }
    if (mounted.current) {
      setTransactions(prev => prev.filter(t => t.id !== id))
      setDebts(prev => prev.filter(d => d.transactionId !== id))
    }
    // Recompute customer totals so total_debt + total_spent stay honest.
    if (customerId) {
      await recalculateCustomerSummary(customerId)
      await refreshCustomers()
    }
    return { ok: true }
  }), [transactions, wrap, recalculateCustomerSummary, refreshCustomers])

  // ---------- DEBTS ----------
  // Bayar hutang — atomic flow yang mengupdate KEEMPAT tabel sekaligus
  // (debt_payments, debts, transactions, customers). Tidak hanya bergantung
  // pada SQL trigger; client-side update juga eksplisit agar:
  //   1. UI bisa update langsung sebelum realtime echo datang.
  //   2. Kalau trigger DB gagal/tidak terpasang, data tetap konsisten.
  // payDebt (Piutang) — DELEGATE ke processDebtPayment.
  // Signature lama dipertahankan: (debtId, amount, paymentMethod, notes).
  // Internal: ambil invoice_no dari debt row, lalu panggil canonical helper
  // sehingga rumus pengurangan IDENTIK dengan jalur Order.
  const payDebt = useCallback(async (debtId, amount, paymentMethod = 'cash', notes = '') => {
    const amt = Number(amount)
    if (!amt || amt <= 0) return { ok: false, error: 'Nominal pembayaran harus lebih dari 0' }
    // Resolve debt → invoice_no
    const { data: debtBefore, error: debtFetchErr } = await supabase
      .from('debts').select('id, invoice_no, transaction_id, customer_id').eq('id', debtId).maybeSingle()
    if (debtFetchErr || !debtBefore) {
      return { ok: false, error: debtFetchErr?.message || 'Hutang tidak ditemukan' }
    }
    // Fallback: kalau debt tidak punya invoice_no, lookup via transactions
    let invoiceNo = debtBefore.invoice_no
    if (!invoiceNo && debtBefore.transaction_id) {
      const { data: trx } = await supabase
        .from('transactions').select('invoice_no').eq('id', debtBefore.transaction_id).maybeSingle()
      invoiceNo = trx?.invoice_no || null
    }
    if (!invoiceNo) return { ok: false, error: 'invoice_no kosong di debt + transaction' }
    return await processDebtPayment({
      invoice_no: invoiceNo,
      paymentAmount: amt,
      paymentMethod,
      notes,
    })
  }, [processDebtPayment])

  const deleteDebt = useCallback(async (id) => wrap(async () => {
    const debt = debts.find(d => d.id === id)
    const customerId = debt?.customerId || null
    // FK CASCADE on debt_payments.debt_id wipes history rows automatically.
    const { error: e } = await supabase.from('debts').delete().eq('id', id)
    if (e) return { ok: false, error: e.message }
    if (mounted.current) setDebts(prev => prev.filter(d => d.id !== id))
    if (customerId) {
      await recalculateCustomerSummary(customerId)
      await refreshCustomers()
    }
    return { ok: true }
  }), [debts, wrap, recalculateCustomerSummary, refreshCustomers])

  const getDebtPayments = useCallback(async (debtId) => {
    const { data, error: e } = await supabase
      .from('debt_payments').select('*').eq('debt_id', debtId).order('paid_at', { ascending: true })
    if (e) return { ok: false, error: e.message, data: [] }
    return { ok: true, data: data || [] }
  }, [])

  // ---------- STATS ----------
  const stats = useMemo(() => {
    const today = new Date().toDateString()
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const todayTrx = transactions.filter(t => new Date(t.date).toDateString() === today)
    const monthTrx = transactions.filter(t => new Date(t.date) >= monthStart)

    const totalOmzet = transactions.filter(t => t.status === 'lunas').reduce((s, t) => s + t.total, 0)
    const todayOmzet = todayTrx.filter(t => t.status === 'lunas').reduce((s, t) => s + t.total, 0)
    const monthOmzet = monthTrx.filter(t => t.status === 'lunas').reduce((s, t) => s + t.total, 0)
    const pendingCount = transactions.filter(t => t.status === 'pending').length
    const procesCount = transactions.filter(t => t.status === 'proses').length
    const todayOrders = todayTrx.length
    const monthOrders = monthTrx.length

    const productSales = {}
    transactions.forEach(t => t.items.forEach(i => {
      productSales[i.productId] = (productSales[i.productId] || 0) + i.qty
    }))
    const topProducts = products
      .map(p => ({ ...p, sold: productSales[p.id] || 0 }))
      .sort((a, b) => b.sold - a.sold).slice(0, 5)

    const chartData = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i))
      const ds = d.toDateString()
      const dayTrx = transactions.filter(t => new Date(t.date).toDateString() === ds)
      return {
        day: d.toLocaleDateString('id-ID', { weekday: 'short' }),
        date: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
        omzet: dayTrx.filter(t => t.status === 'lunas').reduce((s, t) => s + t.total, 0),
        transaksi: dayTrx.length,
      }
    })

    const categoryRevenue = {}
    transactions.forEach(t => t.items.forEach(item => {
      const p = products.find(x => x.id === item.productId)
      if (!p) return
      categoryRevenue[p.category] = (categoryRevenue[p.category] || 0) + (item.qty * item.price)
    }))
    const categoryData = Object.entries(categoryRevenue).map(([name, value]) => ({ name, value }))

    // Customer + debt stats
    const activeDebts = debts.filter(d => d.status === 'aktif')
    const totalActiveDebt = activeDebts.reduce((s, d) => s + d.remaining, 0)
    const totalPaidDebt = debts.filter(d => d.status === 'lunas').reduce((s, d) => s + d.totalDebt, 0)
    const topDebtors = (() => {
      const map = new Map()
      activeDebts.forEach(d => {
        const c = customers.find(x => x.id === d.customerId)
        if (!c) return
        const cur = map.get(c.id) || { ...c, count: 0, totalRemaining: 0 }
        cur.count += 1
        cur.totalRemaining += d.remaining
        map.set(c.id, cur)
      })
      return [...map.values()].sort((a, b) => b.totalRemaining - a.totalRemaining).slice(0, 5)
    })()

    // Top customer (most active)
    const topCustomers = (() => {
      const map = new Map()
      transactions.forEach(t => {
        if (!t.customerId) return
        const c = customers.find(x => x.id === t.customerId)
        if (!c) return
        const cur = map.get(c.id) || { ...c, orderCount: 0, totalSpent: 0 }
        cur.orderCount += 1
        cur.totalSpent += +t.total || 0
        map.set(c.id, cur)
      })
      return [...map.values()].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 5)
    })()

    return {
      totalOmzet, todayOmzet, monthOmzet,
      todayOrders, monthOrders,
      pendingCount, procesCount,
      customers: customers.length, totalCustomers: customers.length,
      topProducts, chartData, todayTrx, monthTrx, categoryData,
      totalTransactions: transactions.length,
      totalActiveDebt, totalPaidDebt, activeDebtsCount: activeDebts.length,
      topDebtors, topCustomers,
    }
  }, [transactions, products, customers, debts])

  return {
    loading, busy, error,
    products, transactions, storeInfo, stats,
    admins, currentUser, customers, debts,
    refreshAll, refreshCustomers, refreshDebts, refreshTransactions,
    syncDebtPaymentStatus, recalculateCustomerSummary, processDebtPayment,
    addProduct, updateProduct, deleteProduct,
    addTransaction, updateTransactionStatus, updateTransactionPayment, deleteTransaction,
    updateOrderStatus,
    updateStoreInfo, updateLogo,
    login, logout, addAdmin, deleteAdmin, changePassword,
    addCustomer, updateCustomer, deleteCustomer,
    payDebt, deleteDebt, getDebtPayments,
  }
}
