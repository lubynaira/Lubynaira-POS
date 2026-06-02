/**
 * WhatsApp utilities — phone normalization + message templates.
 */

import { formatRupiah } from './helpers'

/**
 * Normalize an Indonesian phone number to international format (62...).
 * - strips spaces, dashes, parentheses, dots
 * - leading "08" becomes "628"
 * - leading "+62" becomes "62"
 * - leading "8" (already missing the 0) becomes "628"
 */
export function normalizePhone(raw) {
  if (!raw) return ''
  let s = String(raw).replace(/[^\d+]/g, '')
  if (s.startsWith('+')) s = s.slice(1)
  if (s.startsWith('0')) s = '62' + s.slice(1)
  else if (s.startsWith('8')) s = '62' + s
  else if (!s.startsWith('62')) s = '62' + s
  return s
}

/** Returns true if a string is a usable WA number (after normalization). */
export function isValidWA(raw) {
  const n = normalizePhone(raw)
  return /^62\d{8,14}$/.test(n)
}

/** Build a wa.me URL with pre-filled text. */
export function buildWaLink(phone, text) {
  const n = normalizePhone(phone)
  const t = encodeURIComponent(text || '')
  return n ? `https://wa.me/${n}?text=${t}` : `https://wa.me/?text=${t}`
}

// ---------- TEMPLATES ----------

export const TEMPLATES = {
  chat: ({ name, storeName }) =>
    `Halo ${name || 'Customer'}, terima kasih sudah berbelanja${storeName ? ` di ${storeName}` : ''}. Semoga selalu puas dengan layanan kami 🙏`,

  reminder: ({ name, remaining, invoiceNo, dueDate }) => {
    const lines = [
      `Halo ${name || 'Customer'},`,
      ``,
      `Kami ingin mengingatkan bahwa masih terdapat sisa pembayaran sebesar *${formatRupiah(remaining)}*${invoiceNo ? ` untuk invoice ${invoiceNo}` : ''}.`,
      dueDate ? `Jatuh tempo: *${dueDate}*` : null,
      ``,
      `Mohon segera dilakukan pembayaran. Terima kasih atas perhatiannya 🙏`,
    ].filter(Boolean)
    return lines.join('\n')
  },

  invoice: ({ name, invoiceNo, total, link, storeName = '' }) => {
    const lines = [
      `Halo ${name || 'Customer'}, berikut invoice pesanan Anda:`,
      ``,
      `*Invoice:* ${invoiceNo || '-'}`,
      `*Total:* ${formatRupiah(total || 0)}`,
      link ? `*Link:* ${link}` : null,
      ``,
      `Terima kasih telah berbelanja${storeName ? ` di ${storeName}` : ''} 🙏`,
    ].filter(Boolean)
    return lines.join('\n')
  },

  thanks: ({ name, invoiceNo, total }) =>
    `Halo ${name || 'Customer'}, terima kasih atas pembayaran sebesar *${formatRupiah(total || 0)}*${invoiceNo ? ` untuk invoice ${invoiceNo}` : ''}. Pesanan Anda sedang kami proses 🚀`,
}

/** Copy text to clipboard (with fallback). */
export async function copyToClipboard(text) {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    return true
  } catch {
    return false
  }
}
