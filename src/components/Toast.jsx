import React, { createContext, useCallback, useContext, useState, useEffect } from 'react'
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from 'lucide-react'

const ToastContext = createContext(null)

let _id = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const push = useCallback((kind, message, timeout = 3500) => {
    const id = ++_id
    setToasts(prev => [...prev, { id, kind, message }])
    if (timeout > 0) setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, timeout)
    return id
  }, [])

  const remove = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const api = {
    success: (m, t) => push('success', m, t),
    error:   (m, t) => push('error', m, t),
    info:    (m, t) => push('info', m, t),
    warning: (m, t) => push('warning', m, t),
    push,
    remove,
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onRemove={remove} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    // graceful no-op if used outside provider
    return { success: () => {}, error: () => {}, info: () => {}, warning: () => {}, push: () => {}, remove: () => {} }
  }
  return ctx
}

const KIND_STYLE = {
  success: { bg: 'rgba(16,217,138,0.12)', color: '#10d98a', border: 'rgba(16,217,138,0.4)', Icon: CheckCircle2 },
  error:   { bg: 'rgba(255,77,106,0.12)', color: '#ff4d6a', border: 'rgba(255,77,106,0.4)', Icon: AlertCircle },
  warning: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: 'rgba(245,158,11,0.4)', Icon: AlertTriangle },
  info:    { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6', border: 'rgba(59,130,246,0.4)', Icon: Info },
}

function ToastViewport({ toasts, onRemove }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {toasts.map(t => {
        const s = KIND_STYLE[t.kind] || KIND_STYLE.info
        const Icon = s.Icon
        return (
          <div
            key={t.id}
            className="animate-slideInRight"
            style={{
              minWidth: 240,
              maxWidth: 380,
              background: 'rgba(28,28,40,0.92)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: `1px solid ${s.border}`,
              borderLeft: `3px solid ${s.color}`,
              borderRadius: 12,
              padding: '12px 14px',
              boxShadow: '0 12px 36px rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              pointerEvents: 'auto',
            }}
          >
            <div
              style={{
                width: 28, height: 28,
                borderRadius: 8,
                background: s.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon size={14} style={{ color: s.color }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  fontFamily: 'DM Sans',
                  lineHeight: 1.4,
                }}
              >
                {t.message}
              </p>
            </div>
            <button
              onClick={() => onRemove(t.id)}
              style={{
                width: 22, height: 22,
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                color: 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <X size={12} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
