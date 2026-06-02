import React from 'react'
import { AlarmClock } from 'lucide-react'
import { buildWaLink, isValidWA } from '../utils/whatsapp'
import { TEMPLATES } from '../utils/whatsapp'

/**
 * Reminder-flavor WhatsApp button (amber). Sends the "reminder" template
 * for outstanding debt automatically.
 *
 * Props:
 *   customer  - { name, phone | whatsapp }
 *   remaining - number (sisa hutang)
 *   invoiceNo - optional
 *   dueDate   - optional formatted string
 */
export default function WhatsAppReminder({
  customer,
  remaining,
  invoiceNo,
  dueDate,
  size = 'md',
  label = 'Reminder',
  className = '',
}) {
  const phone = customer?.whatsapp || customer?.phone || ''
  const valid = isValidWA(phone)
  const text = TEMPLATES.reminder({
    name: customer?.name,
    remaining: Number(remaining) || 0,
    invoiceNo,
    dueDate,
  })
  const link = buildWaLink(phone, text)

  const sizes = {
    sm: { icon: 12, pad: 'px-2.5 py-1 text-xs' },
    md: { icon: 14, pad: 'px-3 py-2 text-xs' },
    lg: { icon: 15, pad: 'px-4 py-2.5 text-sm' },
  }
  const sz = sizes[size] || sizes.md

  return (
    <button
      type="button"
      onClick={(e) => {
        if (!valid) return
        e.stopPropagation()
        window.open(link, '_blank', 'noopener,noreferrer')
      }}
      disabled={!valid}
      className={`btn-press inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all ${sz.pad} ${className}`}
      style={{
        background: valid
          ? 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(234,88,12,0.1))'
          : 'rgba(255,255,255,0.04)',
        color: valid ? '#f59e0b' : 'var(--text-muted)',
        border: '1px solid ' + (valid ? 'rgba(245,158,11,0.4)' : 'var(--border)'),
        opacity: valid ? 1 : 0.5,
        cursor: valid ? 'pointer' : 'not-allowed',
        fontFamily: 'Syne',
      }}
      title={valid ? 'Kirim reminder via WhatsApp' : 'Nomor WA tidak valid'}
    >
      <AlarmClock size={sz.icon} />
      {label}
    </button>
  )
}
