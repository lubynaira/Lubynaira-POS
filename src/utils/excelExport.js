import * as XLSX from 'xlsx'
import { CATEGORIES } from '../data/dummyData'
import { getUnit } from './helpers'

const PAYMENT_LABEL = {
  cash: 'Cash', transfer: 'Transfer', qris: 'QRIS', hutang: 'Hutang/Tempo',
}
const STATUS_LABEL = {
  pending: 'Pending', proses: 'Proses', selesai: 'Selesai', lunas: 'Lunas',
}
const catLabel = (id) => CATEGORIES.find(c => c.id === id)?.label || id || '-'

const RP_FORMAT = '"Rp"#,##0;[Red]"-Rp"#,##0;"Rp"0'

// ---------- helpers ----------

function autoWidth(aoa, headerRowIdx) {
  if (!aoa.length) return []
  const colCount = aoa[headerRowIdx]?.length || 0
  return Array.from({ length: colCount }, (_, ci) => {
    let max = 8
    for (let ri = 0; ri < aoa.length; ri++) {
      const v = aoa[ri]?.[ci]
      if (v == null) continue
      const len = String(v).length
      if (len > max) max = len
    }
    return { wch: Math.min(45, Math.max(8, max + 2)) }
  })
}

function applyCurrencyFormat(ws, rows, cols, fromRow) {
  for (let ri = fromRow; ri <= fromRow + rows - 1; ri++) {
    cols.forEach(ci => {
      const addr = XLSX.utils.encode_cell({ r: ri, c: ci })
      if (ws[addr] && typeof ws[addr].v === 'number') ws[addr].z = RP_FORMAT
    })
  }
}

function freeze(ws, rows = 1) {
  ws['!freeze'] = { xSplit: 0, ySplit: rows }
}

// ---------- main export ----------

/**
 * Export transaksi ke Excel (xlsx) — multi-sheet rekap profesional.
 *
 * @param {Array} transactions  already filtered
 * @param {Object} storeInfo
 * @param {Object} options { products, customers, periodLabel, filename }
 */
export function exportTransactionsXLSX(transactions, storeInfo = {}, options = {}) {
  const products = options.products || []
  const customers = options.customers || []
  const periodLabel = options.periodLabel || 'Semua waktu'
  const wb = XLSX.utils.book_new()

  const totalOrder = transactions.length
  const totalOmzet = transactions.reduce((s, t) => s + (+t.total || 0), 0)
  const totalItem = transactions.reduce((s, t) => s + (t.items || []).reduce((q, i) => q + (+i.qty || 0), 0), 0)
  const totalPaid = transactions.reduce((s, t) => s + (+t.paid || 0), 0)
  const totalRemaining = transactions.reduce((s, t) => s + (+t.remaining || 0), 0)
  const totalPending = transactions.filter(t => t.status === 'pending').length
  const totalSelesai = transactions.filter(t => t.status === 'lunas' || t.status === 'selesai').length
  const totalBatal = transactions.filter(t => t.status === 'dibatalkan').length

  // ===== SHEET 1: DASHBOARD RINGKASAN =====
  {
    const aoa = []
    aoa.push([`${storeInfo?.name || 'Luby Naira'} — REKAP TRANSAKSI`])
    if (storeInfo?.tagline) aoa.push([storeInfo?.tagline])
    if (storeInfo?.address) aoa.push([storeInfo?.address])
    if (storeInfo?.phone) aoa.push([`Telp: ${storeInfo?.phone}`])
    aoa.push([])
    aoa.push([`Periode: ${periodLabel}`])
    aoa.push([`Dibuat: ${new Date().toLocaleString('id-ID')}`])
    aoa.push([])
    aoa.push(['STATISTIK', 'NILAI'])
    aoa.push(['Total Order', totalOrder])
    aoa.push(['Total Omzet', totalOmzet])
    aoa.push(['Total Item Terjual', totalItem])
    aoa.push(['Total Pembayaran Diterima', totalPaid])
    aoa.push(['Total Piutang (Belum Lunas)', totalRemaining])
    aoa.push(['Total Status Pending', totalPending])
    aoa.push(['Total Status Selesai/Lunas', totalSelesai])
    aoa.push(['Total Status Dibatalkan', totalBatal])

    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 1 } },
      { s: { r: 5, c: 0 }, e: { r: 5, c: 1 } },
      { s: { r: 6, c: 0 }, e: { r: 6, c: 1 } },
    ]
    ws['!cols'] = [{ wch: 36 }, { wch: 24 }]
    // Currency format on omzet/piutang/paid rows
    const currencyRows = [9, 11, 12] // 0-indexed rows in the values column
    currencyRows.forEach(r => {
      const addr = XLSX.utils.encode_cell({ r, c: 1 })
      if (ws[addr]) ws[addr].z = RP_FORMAT
    })
    XLSX.utils.book_append_sheet(wb, ws, 'Dashboard')
  }

  // ===== SHEET 2: DETAIL ORDER =====
  {
    const aoa = []
    const headers = [
      'No', 'Tanggal', 'Jam', 'Nomor Order', 'Nomor Invoice', 'Nama Pelanggan', 'No WhatsApp',
      'Nama Produk', 'Kategori', 'Qty', 'Satuan', 'Harga', 'Subtotal Item',
      'Subtotal Trx', 'Diskon', 'Total', 'Metode Pembayaran', 'Status Pembayaran', 'Status Order',
      'Catatan', 'Kasir',
    ]
    aoa.push(headers)

    let no = 0
    const findCustomer = (cid) => customers.find(c => c.id === cid)
    const productFor = (productId) => products.find(x => x.id === productId)
    const catFor = (productId) => {
      if (!productId) return '-'
      return catLabel(productFor(productId)?.category)
    }
    // Resolve unit label from item (if stored) or fallback to product master
    const unitLabelFor = (item) => {
      const raw = item?.unit || productFor(item?.productId)?.unit || 'pcs'
      return getUnit(raw).label
    }

    transactions.forEach(t => {
      const cust = findCustomer(t.customerId)
      const whatsapp = cust?.whatsapp || cust?.phone || ''
      const items = t.items?.length ? t.items : [null]
      items.forEach(item => {
        no += 1
        const dt = new Date(t.date)
        const qtyNum = +item?.qty || 0
        aoa.push([
          no,
          dt.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          t.orderNo || t.invoiceNo || '',
          t.invoiceNo || '',
          t.customer || 'Umum',
          whatsapp,
          item?.name || '-',
          catFor(item?.productId),
          qtyNum,
          item ? unitLabelFor(item) : '-',
          +item?.price || 0,
          qtyNum * (+item?.price || 0),
          +t.subtotal || 0,
          +t.discount || 0,
          +t.total || 0,
          PAYMENT_LABEL[t.paymentMethod] || t.paymentMethod || '',
          STATUS_LABEL[t.status] || t.status || '',
          t.orderStatus || '-',
          t.notes || '',
          t.cashier || '-',
        ])
      })
    })

    // Totals row — note extra '' inserted for the new Satuan column
    aoa.push([
      '', '', '', '', '', '', '', '', 'TOTAL', '', '', '',
      transactions.reduce((s, t) =>
        s + (t.items || []).reduce((q, i) => q + (+i.qty || 0) * (+i.price || 0), 0), 0),
      transactions.reduce((s, t) => s + (+t.subtotal || 0), 0),
      transactions.reduce((s, t) => s + (+t.discount || 0), 0),
      totalOmzet,
      '', '', '', '', '',
    ])

    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = autoWidth(aoa, 0)
    // Currency columns shift by +1 because of inserted Satuan column:
    // 11 (Harga), 12 (Subtotal Item), 13 (Subtotal Trx), 14 (Diskon), 15 (Total)
    const currencyCols = [11, 12, 13, 14, 15]
    applyCurrencyFormat(ws, aoa.length - 1, currencyCols, 1)
    freeze(ws, 1)
    XLSX.utils.book_append_sheet(wb, ws, 'Detail Order')
  }

  // ===== SHEET 3: REKAP PELANGGAN =====
  {
    const aoa = [['Nama Pelanggan', 'Nomor WhatsApp', 'Jumlah Order', 'Total Belanja', 'Total Pembayaran', 'Total Piutang', 'Sisa Piutang']]
    const map = new Map()
    transactions.forEach(t => {
      const key = t.customerId || t.customer || 'umum'
      const cust = customers.find(c => c.id === t.customerId)
      const wa = cust?.whatsapp || cust?.phone || ''
      const cur = map.get(key) || {
        name: cust?.name || t.customer || 'Umum',
        wa,
        orders: 0,
        total: 0,
        paid: 0,
        debt: 0,
      }
      cur.orders += 1
      cur.total += +t.total || 0
      cur.paid += +t.paid || 0
      cur.debt += +t.remaining || 0
      map.set(key, cur)
    })
    const list = [...map.values()].sort((a, b) => b.total - a.total)
    list.forEach(r => aoa.push([
      r.name, r.wa, r.orders, r.total, r.paid, r.total, r.debt,
    ]))
    // Totals
    aoa.push([
      'TOTAL', '',
      list.reduce((s, r) => s + r.orders, 0),
      list.reduce((s, r) => s + r.total, 0),
      list.reduce((s, r) => s + r.paid, 0),
      list.reduce((s, r) => s + r.total, 0),
      list.reduce((s, r) => s + r.debt, 0),
    ])

    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = autoWidth(aoa, 0)
    applyCurrencyFormat(ws, aoa.length - 1, [3, 4, 5, 6], 1)
    freeze(ws, 1)
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Pelanggan')
  }

  // ===== SHEET 4: REKAP PRODUK =====
  {
    const aoa = [['Nama Produk', 'Kategori', 'Satuan', 'Qty Terjual', 'Jumlah Transaksi', 'Omzet', 'Harga Rata-rata']]
    const map = new Map()
    transactions.forEach(t => {
      const seenInTrx = new Set()
      ;(t.items || []).forEach(item => {
        if (!item.name) return
        const key = item.productId || item.name
        const productMaster = products.find(p => p.id === item.productId)
        const unitRaw = item.unit || productMaster?.unit || 'pcs'
        const cur = map.get(key) || {
          name: item.name,
          category: catLabel(productMaster?.category),
          unit: getUnit(unitRaw).label,
          qty: 0,
          trxCount: 0,
          omzet: 0,
        }
        cur.qty += +item.qty || 0
        cur.omzet += (+item.qty || 0) * (+item.price || 0)
        if (!seenInTrx.has(key)) { cur.trxCount += 1; seenInTrx.add(key) }
        map.set(key, cur)
      })
    })
    const list = [...map.values()].sort((a, b) => b.qty - a.qty)
    list.forEach(r => aoa.push([
      r.name, r.category, r.unit, r.qty, r.trxCount, r.omzet,
      r.qty > 0 ? Math.round(r.omzet / r.qty) : 0,
    ]))
    aoa.push([
      'TOTAL', '', '',
      list.reduce((s, r) => s + r.qty, 0),
      list.reduce((s, r) => s + r.trxCount, 0),
      list.reduce((s, r) => s + r.omzet, 0),
      '',
    ])

    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = autoWidth(aoa, 0)
    // Currency cols shift +1: Omzet (5), Harga Rata-rata (6)
    applyCurrencyFormat(ws, aoa.length - 1, [5, 6], 1)
    freeze(ws, 1)
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Produk')
  }

  // ===== WRITE =====
  const filename = options.filename
    || `Rekap-Order-${new Date().toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(wb, filename)
  return { ok: true, filename, count: transactions.length, total: totalOmzet }
}

/**
 * Convenience: export single customer history.
 */
export function exportCustomerTransactionsXLSX(customer, transactions, storeInfo = {}) {
  const periodLabel = `Customer: ${customer.name}`
  const filename = `Histori-${customer.name.replace(/\s+/g, '_')}-${new Date().toISOString().slice(0, 10)}.xlsx`
  return exportTransactionsXLSX(transactions, storeInfo, {
    periodLabel,
    filename,
    customers: [customer],
  })
}
