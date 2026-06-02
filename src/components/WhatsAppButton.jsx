import React, { useState } from 'react'
import { MessageCircle, Copy, Check } from 'lucide-react'
import { buildWaLink, isValidWA, normalizePhone, copyToClipboard } from '../utils/whatsapp'

/**
 * Reusable WhatsApp button.
 *
 * Props:
 *   phone        - raw phone number (08xxx, +62xxx, etc.)
 *   text         - prefilled message
 *   variant      - 'icon' | 'pill' | 'inline'  (default 'icon')
 *   label        - text label for non-icon variants
 *   size         - 'sm' | 'md' | 'lg'
 *   showCopy     - show a copy-number button beside (default false)
 *   tooltip      - tooltip text (default: "Chat via WhatsApp")
 *   disabled     - force disable
 *   className    - extra classes
 */
export default function WhatsAppButton({
  phone,
  text = '',
  variant = 'icon',
  label = 'WhatsApp',
  size = 'md',
  showCopy = false,
  tooltip = 'Chat via WhatsApp',
  disabled = false,
  className = '',
}) {
  const [hover, setHover] = useState(false)
  const [copied, setCopied] = useState(false)
  const valid = isValidWA(phone)
  const link = buildWaLink(phone, text)
  const normalized = normalizePhone(phone)
  // Only disable when explicitly disabled via prop.
  // When no phone, still open WhatsApp picker (user chooses contact).
  const isDisabled = disabled

  const handleClick = (e) => {
    if (isDisabled) return
    e.stopPropagation()
    e.preventDefault()
    try {
      const w = window.open(link, '_blank', 'noopener,noreferrer')
      // Some popup-blockers return null — fallback to same-tab navigation
      if (!w || w.closed || typeof w.closed === 'undefined') {
        window.location.href = link
      }
    } catch {
      window.location.href = link
    }
  }

  const handleCopy = async (e) => {
    e.stopPropagation()
    if (!normalized) return
    const ok = await copyToClipboard(normalized)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  const sizes = {
    sm: { icon: 12, padIcon: 'w-7 h-7', padPill: 'px-2.5 py-1 text-xs' },
    md: { icon: 14, padIcon: 'w-9 h-9', padPill: 'px-3 py-2 text-xs' },
    lg: { icon: 16, padIcon: 'w-11 h-11', padPill: 'px-4 py-2.5 text-sm' },
  }
  const sz = sizes[size] || sizes.md

  // Visual softer state if phone is missing — but still clickable
  const muted = !valid && !disabled
  const iconBase = {
    background: isDisabled
      ? 'rgba(255,255,255,0.04)'
      : muted
      ? 'linear-gradient(135deg, rgba(37,211,102,0.6), rgba(18,140,126,0.6))'
      : 'linear-gradient(135deg, #25d366, #128c7e)',
    color: isDisabled ? 'var(--text-muted)' : '#fff',
    border: '1px solid ' + (isDisabled ? 'var(--border)' : 'rgba(37,211,102,0.4)'),
    boxShadow: isDisabled || muted ? 'none' : '0 2px 12px rgba(37,211,102,0.25)',
    fontFamily: 'Syne',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.5 : 1,
  }
  const effectiveTooltip = isDisabled ? 'Tombol dinonaktifkan'
    : muted ? 'Tidak ada nomor — buka WhatsApp untuk pilih kontak'
    : tooltip

  const button = variant === 'icon' ? (
    <button
      type="button"
      onClick={handleClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={isDisabled}
      className={`btn-press relative flex items-center justify-center rounded-xl transition-all ${sz.padIcon} ${className}`}
      style={iconBase}
      title={effectiveTooltip}
    >
      <MessageCircle size={sz.icon} />
      {hover && !isDisabled && tooltip && (
        <span
          className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs px-2 py-1 rounded-md pointer-events-none animate-fadeIn"
          style={{
            background: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-strong)',
            fontFamily: 'DM Sans',
            zIndex: 10,
          }}
        >
          {tooltip}
        </span>
      )}
    </button>
  ) : (
    <button
      type="button"
      onClick={handleClick}
      disabled={isDisabled}
      className={`btn-press inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all ${sz.padPill} ${className}`}
      style={iconBase}
      title={effectiveTooltip}
    >
      <MessageCircle size={sz.icon} />
      {label}
    </button>
  )

  if (!showCopy) return button

  return (
    <div className="inline-flex items-center gap-1.5">
      {button}
      <button
        type="button"
        onClick={handleCopy}
        disabled={!normalized}
        title={normalized ? `Copy ${normalized}` : 'Tidak ada nomor'}
        className={`btn-press flex items-center justify-center rounded-xl transition-all ${sz.padIcon}`}
        style={{
          background: 'var(--bg-card)',
          color: copied ? '#10d98a' : 'var(--text-secondary)',
          border: '1px solid var(--border)',
          opacity: normalized ? 1 : 0.4,
        }}
      >
        {copied ? <Check size={sz.icon} /> : <Copy size={sz.icon} />}
      </button>
    </div>
  )
}
