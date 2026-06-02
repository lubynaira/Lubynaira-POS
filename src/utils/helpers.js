export function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0)
}

export function formatNumber(n) {
  return new Intl.NumberFormat('id-ID').format(Number(n) || 0)
}

export function formatCompact(n) {
  const v = Number(n) || 0
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'Jt'
  if (v >= 1_000) return (v / 1_000).toFixed(0) + 'rb'
  return String(v)
}

export function formatDate(dateStr, opts = {}) {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...opts,
  })
}

export function formatDateTime(dateStr) {
  return new Date(dateStr).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'baru saja'
  if (diff < 3600) return Math.floor(diff / 60) + ' menit lalu'
  if (diff < 86400) return Math.floor(diff / 3600) + ' jam lalu'
  if (diff < 604800) return Math.floor(diff / 86400) + ' hari lalu'
  return formatDate(dateStr)
}

export function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function classNames(...classes) {
  return classes.filter(Boolean).join(' ')
}

export function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Generates a stylized QR-like pattern SVG (deterministic from input string).
 * Not a real QR code, but visually represents a payment QR for invoice printing.
 */
export function generateQRPattern(text, size = 21) {
  // Simple hash-based grid generator
  let h = 0
  for (let i = 0; i < text.length; i++) {
    h = (h * 31 + text.charCodeAt(i)) >>> 0
  }
  const grid = []
  for (let y = 0; y < size; y++) {
    grid[y] = []
    for (let x = 0; x < size; x++) {
      // Three position anchors (corners)
      const inAnchor = (
        (x < 7 && y < 7) ||
        (x >= size - 7 && y < 7) ||
        (x < 7 && y >= size - 7)
      )
      if (inAnchor) {
        const isOuter = (x === 0 || x === 6 || y === 0 || y === 6) ||
                        (x === size - 7 || x === size - 1 || (y === 0 || y === 6)) ||
                        ((x === 0 || x === 6) && y >= size - 7) ||
                        (y === size - 7 || y === size - 1)
        const inAnchorCorner =
          (x < 7 && y < 7 && ((x === 0 || x === 6 || y === 0 || y === 6))) ||
          (x >= size - 7 && y < 7 && ((x === size - 7 || x === size - 1 || y === 0 || y === 6))) ||
          (x < 7 && y >= size - 7 && ((x === 0 || x === 6 || y === size - 7 || y === size - 1)))
        const inAnchorCenter =
          (x >= 2 && x <= 4 && y >= 2 && y <= 4) ||
          (x >= size - 5 && x <= size - 3 && y >= 2 && y <= 4) ||
          (x >= 2 && x <= 4 && y >= size - 5 && y <= size - 3)
        grid[y][x] = inAnchorCorner || inAnchorCenter
      } else {
        h = (h * 1664525 + 1013904223) >>> 0
        grid[y][x] = ((h >> (x % 16)) & 1) === 1
      }
    }
  }
  return grid
}

export const STATUS_MAP = {
  pending: { label: 'Pending', color: 'amber', hex: '#f59e0b' },
  proses: { label: 'Proses', color: 'blue', hex: '#3b82f6' },
  selesai: { label: 'Selesai', color: 'green', hex: '#10d98a' },
  lunas: { label: 'Lunas', color: 'accent', hex: '#a78bfa' },
}

// ---------- UNIT (PCS / Meter / Yard) ----------

export const UNIT_OPTIONS = [
  { id: 'pcs',   label: 'PCS',   short: 'pcs',   decimal: false },
  { id: 'meter', label: 'Meter', short: 'm',     decimal: true  },
  { id: 'yard',  label: 'Yard',  short: 'yd',    decimal: true  },
]

/** Returns the unit config (or PCS fallback). */
export function getUnit(unit) {
  return UNIT_OPTIONS.find(u => u.id === (unit || 'pcs').toLowerCase()) || UNIT_OPTIONS[0]
}

/** True if the unit supports decimals (meter/yard). */
export function unitAllowsDecimal(unit) {
  return getUnit(unit).decimal
}

/**
 * Format a quantity for display, e.g. 1.5 → "1,5 Meter", 3 → "3 PCS",
 * 1500 → "1.500 PCS", 10000 → "10.000 PCS" (Indonesian thousand
 * separator). Decimal units (meter/yard) use comma as decimal separator
 * and still apply the thousand grouping to the integer part.
 */
export function formatQty(qty, unit = 'pcs') {
  const u = getUnit(unit)
  const n = Number(qty) || 0
  const intl = new Intl.NumberFormat('id-ID')
  let str
  if (u.decimal) {
    if (Number.isInteger(n)) {
      str = intl.format(n)
    } else {
      const int = Math.trunc(n)
      const dec = Math.abs(n - int).toFixed(2).slice(2).replace(/0+$/, '')
      const intStr = intl.format(int)
      str = dec ? `${intStr},${dec}` : intStr
    }
  } else {
    str = intl.format(Math.round(n))
  }
  return `${str} ${u.label}`
}

/**
 * Parse a quantity string into a number.
 * - Accepts Indonesian comma ("1,5") and dot ("1.5")
 * - Returns 0 for invalid input
 */
export function parseQty(str, allowDecimal = false) {
  if (str === '' || str == null) return 0
  const normalized = String(str).trim().replace(',', '.').replace(/[^\d.]/g, '')
  if (!normalized) return 0
  const n = allowDecimal ? parseFloat(normalized) : parseInt(normalized, 10)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export function nextInvoiceNo(existing = []) {
  const year = new Date().getFullYear()
  const yearTrx = existing.filter(t => (t.invoiceNo || '').includes(`INV-${year}`))
  const num = yearTrx.length + 1
  return `INV-${year}-${String(num).padStart(4, '0')}`
}

/** Escape a value for CSV cells */
function csvEscape(v) {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/**
 * Build a CSV string from headers + rows of values.
 * Adds a BOM so Excel reads UTF-8 correctly.
 */
export function toCSV(headers, rows) {
  const lines = [headers.map(csvEscape).join(',')]
  for (const row of rows) lines.push(row.map(csvEscape).join(','))
  return '﻿' + lines.join('\n')
}

/** Trigger a browser file download with the given content */
export function downloadFile(filename, content, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Returns YYYY-MM-DD for an input[type=date] value */
export function toDateInputValue(d) {
  if (!d) return ''
  const dt = d instanceof Date ? d : new Date(d)
  const yyyy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** Returns range [start, end] for the given YYYY-MM month */
export function monthRange(yyyyMm) {
  const [y, m] = yyyyMm.split('-').map(Number)
  const start = new Date(y, m - 1, 1, 0, 0, 0)
  const end = new Date(y, m, 0, 23, 59, 59)
  return [start, end]
}

/** Indonesian month name from YYYY-MM */
export function monthLabel(yyyyMm) {
  const [y, m] = yyyyMm.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
}
