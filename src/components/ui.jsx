import React from 'react'

export function Label({ children, required }) {
  return (
    <label
      className="block text-xs font-semibold mb-1.5"
      style={{ color: 'var(--text-secondary)', fontFamily: 'Syne', letterSpacing: '0.02em' }}
    >
      {children} {required && <span style={{ color: 'var(--red)' }}>*</span>}
    </label>
  )
}

export function Input({ label, required, prefix, className = '', ...props }) {
  return (
    <div className="w-full">
      {label && <Label required={required}>{label}</Label>}
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold pointer-events-none"
            style={{ color: 'var(--text-muted)' }}>
            {prefix}
          </span>
        )}
        <input
          className={`w-full px-3 py-2.5 rounded-xl text-sm transition-all ${prefix ? 'pl-8' : ''} ${className}`}
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontFamily: 'DM Sans',
          }}
          {...props}
        />
      </div>
    </div>
  )
}

export function Select({ label, required, children, className = '', ...props }) {
  return (
    <div className="w-full">
      {label && <Label required={required}>{label}</Label>}
      <select
        className={`w-full px-3 py-2.5 rounded-xl text-sm transition-all ${className}`}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
          fontFamily: 'DM Sans',
        }}
        {...props}
      >
        {children}
      </select>
    </div>
  )
}

export function Textarea({ label, required, className = '', ...props }) {
  return (
    <div className="w-full">
      {label && <Label required={required}>{label}</Label>}
      <textarea
        className={`w-full px-3 py-2.5 rounded-xl text-sm transition-all resize-none ${className}`}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
          fontFamily: 'DM Sans',
        }}
        rows={3}
        {...props}
      />
    </div>
  )
}

export function Button({ children, variant = 'primary', size = 'md', className = '', disabled, ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all btn-press select-none disabled:opacity-50 disabled:cursor-not-allowed'
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-sm',
  }
  const variants = {
    primary: {
      background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
      color: '#fff',
      boxShadow: disabled ? 'none' : '0 4px 16px rgba(139,92,246,0.3)',
    },
    secondary: {
      background: 'rgba(255,255,255,0.04)',
      color: 'var(--text-primary)',
      border: '1px solid var(--border)',
    },
    danger: {
      background: 'rgba(255,77,106,0.12)',
      color: 'var(--red)',
      border: '1px solid rgba(255,77,106,0.25)',
    },
    success: {
      background: 'linear-gradient(135deg, #10d98a, #059669)',
      color: '#fff',
      boxShadow: disabled ? 'none' : '0 4px 16px rgba(16,217,138,0.3)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-secondary)',
    },
  }
  return (
    <button
      disabled={disabled}
      className={`${base} ${sizes[size]} ${className}`}
      style={{ fontFamily: 'Syne', ...variants[variant] }}
      {...props}
    >
      {children}
    </button>
  )
}

export function Badge({ children, color = 'accent', className = '' }) {
  const colors = {
    accent: { bg: 'rgba(139,92,246,0.12)', text: '#a78bfa', border: 'rgba(139,92,246,0.25)' },
    green: { bg: 'rgba(16,217,138,0.12)', text: '#10d98a', border: 'rgba(16,217,138,0.25)' },
    red: { bg: 'rgba(255,77,106,0.12)', text: '#ff4d6a', border: 'rgba(255,77,106,0.25)' },
    amber: { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b', border: 'rgba(245,158,11,0.25)' },
    blue: { bg: 'rgba(59,130,246,0.12)', text: '#3b82f6', border: 'rgba(59,130,246,0.25)' },
    gray: { bg: 'rgba(136,136,168,0.1)', text: '#8888a8', border: 'rgba(136,136,168,0.2)' },
  }
  const c = colors[color] || colors.accent
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold whitespace-nowrap ${className}`}
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, fontFamily: 'Syne' }}
    >
      {children}
    </span>
  )
}

export function Card({ children, className = '', hover, ...props }) {
  return (
    <div
      className={`premium-card p-5 ${hover ? 'hover:border-white/10' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {Icon && (
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid var(--border)' }}>
          <Icon size={28} style={{ color: 'var(--text-muted)' }} />
        </div>
      )}
      <h3 className="font-bold text-base mb-1" style={{ fontFamily: 'Syne', color: 'var(--text-primary)' }}>
        {title}
      </h3>
      {description && (
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>{description}</p>
      )}
      {action}
    </div>
  )
}

/** Falling back to a colored initial-based image if `src` fails */
export function ProductImage({ src, alt, className = '', fallbackSize = 60 }) {
  const [err, setErr] = React.useState(false)
  const initial = (alt || 'P')[0].toUpperCase()
  if (err || !src) {
    return (
      <div className={`flex items-center justify-center ${className}`}
        style={{
          background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(99,102,241,0.08))',
          color: 'var(--accent-light)',
          fontFamily: 'Syne',
          fontWeight: 700,
          fontSize: fallbackSize / 2.4,
        }}>
        {initial}
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setErr(true)}
      loading="lazy"
    />
  )
}
