import React from 'react'

/**
 * Luby Naira Logo — inline SVG (yellow wordmark on dark) with optional
 * custom image override.
 *
 * Props:
 *   size       — pixel size (default 40)
 *   variant    — 'icon' (default) or 'full' (icon + "Luby / NAIRA" wordmark)
 *   onLight    — adapt for light background (invoice). Mark stays yellow.
 *   customSrc  — if provided, render this image instead of the built-in SVG
 *                (base64 data URL or http URL)
 */
const YELLOW = '#F2E500'

export default function Logo({
  size = 40,
  variant = 'icon',
  onLight = false,
  customSrc = '',
  className = '',
  style = {},
}) {
  // If user uploaded a custom logo, render it as <img>
  if (customSrc) {
    if (variant === 'full') {
      return (
        <img
          src={customSrc}
          alt="Logo"
          className={className}
          style={{
            height: size,
            width: 'auto',
            maxWidth: size * 3.2,
            objectFit: 'contain',
            display: 'block',
            ...style,
          }}
        />
      )
    }
    return (
      <img
        src={customSrc}
        alt="Logo"
        className={className}
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          borderRadius: size * 0.22,
          background: onLight ? '#fff' : '#0a0a0f',
          display: 'block',
          ...style,
        }}
      />
    )
  }

  // Color of the gaps that carve the "$" out of the S — matches background
  const gap = onLight ? '#ffffff' : '#0a0a0f'

  // ── Blocky "$ / S" mark (yellow) ──────────────────────────────────
  const Icon = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
      className={className}
    >
      {!onLight && <rect width="100" height="100" rx="22" fill="#0a0a0f" />}
      {/* S body — three stacked blocks */}
      <path d="M26,18 L64,18 L64,34 L44,34 L44,42 L26,42 Z" fill={YELLOW} />
      <path d="M26,42 L74,42 L74,58 L26,58 Z" fill={YELLOW} />
      <path d="M26,58 L58,58 L58,66 L74,66 L74,82 L26,82 Z" fill={YELLOW} />
      {/* Vertical dollar bar through the middle */}
      <rect x="47" y="10" width="6" height="80" fill={YELLOW} />
      {/* notch gaps so the bar reads as a "$" */}
      <rect x="44" y="46" width="12" height="6" fill={gap} />
      <rect x="44" y="62" width="12" height="6" fill={gap} />
    </svg>
  )

  if (variant === 'icon') return Icon

  // ── Full lockup: mark + "Luby" over "NAIRA" ─────────────────────
  return (
    <div
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.22, ...style }}
    >
      {Icon}
      <svg
        height={size * 0.82}
        viewBox="0 0 240 110"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
      >
        <text
          x="0" y="58"
          fontFamily="DM Sans, Syne, sans-serif"
          fontWeight="700"
          fontSize="62"
          fill={YELLOW}
          letterSpacing="-1"
        >
          Luby
        </text>
        <rect x="2" y="68" width="216" height="5" rx="2.5" fill={YELLOW} />
        <text
          x="2" y="104"
          fontFamily="Syne, DM Sans, sans-serif"
          fontWeight="800"
          fontSize="34"
          fill={YELLOW}
          letterSpacing="2"
        >
          NAIRA
        </text>
      </svg>
    </div>
  )
}
