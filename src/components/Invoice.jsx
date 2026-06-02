import React, { useRef, useState, useEffect } from 'react'
import { X, Printer, FileText, MessageCircle, Loader2, Download } from 'lucide-react'
import html2canvas from 'html2canvas'
import { formatRupiah, formatDateTime, STATUS_MAP, downloadFile } from '../utils/helpers'
import { STORE_INFO as DEFAULT_STORE } from '../data/dummyData'
import { buildWaLink, normalizePhone, isValidWA } from '../utils/whatsapp'
import Logo from './Logo'

const PAYMENT_LABEL = {
  cash: 'Cash', transfer: 'Bank Transfer', qris: 'QRIS', hutang: 'Hutang / Tempo',
}

export default function Invoice({ transaction: t, onClose, storeInfo, autoShare = false }) {
  const STORE_INFO = storeInfo || DEFAULT_STORE
  const printRef = useRef(null)
  const [sharing, setSharing] = useState(false)
  const [shareInfo, setShareInfo] = useState(null)
  // Kept PNG blob untuk tombol "Lampirkan Invoice" fallback (tidak diupload ke storage)
  const [pendingBlob, setPendingBlob] = useState(null)
  const autoTriggered = useRef(false)
  const status = STATUS_MAP[t.status]
  const isHutang = t.paymentMethod === 'hutang' || (t.remaining || 0) > 0

  /** Render the invoice DOM to a PNG blob — fully captured (no clipping). */
  const renderInvoicePNG = async () => {
    const node = printRef.current
    if (!node) throw new Error('Invoice belum siap')

    // Wait for fonts to load before capture (prevents reflow during render)
    try { if (document.fonts?.ready) await document.fonts.ready } catch {}
    // Two RAFs to ensure layout is stable
    await new Promise(r => requestAnimationFrame(r))
    await new Promise(r => requestAnimationFrame(r))

    // CRITICAL — use scrollWidth/scrollHeight to capture the ENTIRE invoice content,
    // not just what's currently visible inside the modal's scrollable preview area.
    // offsetHeight would be wrong if a parent uses overflow:hidden, but scrollHeight
    // always reflects the natural content height of the element.
    const width = Math.max(node.offsetWidth, node.scrollWidth, 720)
    const height = Math.max(node.offsetHeight, node.scrollHeight)

    const canvas = await html2canvas(node, {
      backgroundColor: '#ffffff',
      scale: 3,                 // high-res 3x for crisp PNG
      useCORS: true,
      allowTaint: true,
      logging: false,
      width,
      height,
      // Window dimensions must be at least as big as the element so layout fits
      windowWidth: Math.max(width, window.innerWidth, document.documentElement.scrollWidth),
      windowHeight: Math.max(height, window.innerHeight, document.documentElement.scrollHeight),
      scrollX: 0,
      scrollY: -window.scrollY,
      onclone: (clonedDoc) => {
        // In the cloned document, force the invoice to render at its full natural
        // height with no parent constraints clipping it.
        const clone = clonedDoc.getElementById('invoice-print')
        if (clone) {
          clone.style.width = width + 'px'
          clone.style.minWidth = width + 'px'
          clone.style.maxWidth = 'none'
          clone.style.height = 'auto'
          clone.style.maxHeight = 'none'
          clone.style.overflow = 'visible'
          clone.style.boxShadow = 'none'
          clone.style.margin = '0'
          clone.style.transform = 'none'
        }
        // Also relax constraints on parent containers in the cloned doc so
        // nothing clips the invoice from above.
        let parent = clone?.parentElement
        while (parent && parent !== clonedDoc.body) {
          parent.style.overflow = 'visible'
          parent.style.maxHeight = 'none'
          parent.style.height = 'auto'
          parent = parent.parentElement
        }
      },
    })

    const blob = await new Promise((resolve) => {
      canvas.toBlob(b => resolve(b), 'image/png')
    })
    if (!blob) throw new Error('Gagal membuat PNG')
    return blob
  }

  const handlePrint = () => {
    const content = printRef.current?.outerHTML || ''
    const win = window.open('', '_blank', 'width=900,height=1200')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html>
      <html><head><title>Invoice ${t.invoiceNo}</title><meta charset="UTF-8" />
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@500;600;700;800&family=DM+Sans:wght@400;500;600;700&family=Bree+Serif&family=Sora:wght@600;700;800&family=Space+Grotesk:wght@500;600;700&family=Inter:wght@500;600;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        html, body { background: #f1f1f5; }
        body { font-family: 'DM Sans', sans-serif; color: #1a1a25; padding: 24px; display: flex; justify-content: center; }
        @media print { @page { size: A4; margin: 12mm; } body { background: #fff; padding: 0; } }
      </style></head><body>${content}</body></html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 600)
  }

  /**
   * Send invoice via WhatsApp — simple & fast.
   *
   * Flow:
   *   1. Generate PNG (in-memory blob)
   *   2. Try Web Share API with file → user picks WhatsApp in OS share sheet,
   *      file attached automatically. This is the ONLY browser-native way
   *      to attach a file directly to WhatsApp.
   *   3. If Web Share with files unsupported → open WhatsApp directly via wa.me
   *      (customer number = direct chat, no number = pick contact),
   *      and keep PNG blob in memory so user can press "Lampirkan Invoice"
   *      button to download it as backup.
   *
   * Tidak ada upload ke Supabase Storage, tidak ada auto-download.
   */
  const handleWhatsApp = async () => {
    if (sharing) return
    setSharing(true)
    setShareInfo({ kind: 'info', text: 'Membuat invoice...' })

    const phone = t.customerPhone || ''
    const hasValidPhone = !!phone && isValidWA(phone)
    const filename = `Invoice-${t.invoiceNo}.png`

    // Build pesan otomatis sesuai spec
    const customerLabel = (!t.customer || /^umum$/i.test(String(t.customer).trim()))
      ? 'Pelanggan Umum' : t.customer
    const message = [
      `Halo ${customerLabel}`,
      `Berikut invoice pesanan Anda.`,
      ``,
      `No Invoice:`,
      t.invoiceNo,
      ``,
      `Total:`,
      formatRupiah(t.total),
      ``,
      `Terima kasih telah menggunakan layanan ${STORE_INFO.name || ''}.`.trimEnd(),
    ].join('\n')

    try {
      // 1. Generate PNG in-memory
      const blob = await renderInvoicePNG()
      const file = new File([blob], filename, { type: 'image/png' })

      // 2. Web Share API with file — best UX (file attached automatically)
      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.canShare === 'function' &&
        typeof navigator.share === 'function' &&
        navigator.canShare({ files: [file] })
      ) {
        try {
          await navigator.share({
            files: [file],
            title: `Invoice ${t.invoiceNo}`,
            text: message,
          })
          setShareInfo({
            kind: 'success',
            text: 'Invoice berhasil dibagikan. Pilih WhatsApp dari daftar.',
          })
          setPendingBlob(null)
          return
        } catch (shareErr) {
          if (shareErr?.name === 'AbortError') {
            setShareInfo(null)
            return
          }
          // Real error → fall through to manual flow
          // eslint-disable-next-line no-console
          console.warn('[Invoice] navigator.share gagal — fallback ke wa.me', shareErr)
        }
      }

      // 3. Fallback — buka WhatsApp directly (chat customer kalau ada nomor)
      //    Simpan blob di state untuk tombol "Lampirkan Invoice"
      setPendingBlob(blob)

      const phonePart = hasValidPhone ? normalizePhone(phone) : ''
      const waUrl = `https://wa.me/${phonePart}?text=${encodeURIComponent(message)}`

      const win = window.open(waUrl, '_blank', 'noopener,noreferrer')
      if (!win || win.closed || typeof win.closed === 'undefined') {
        window.location.href = waUrl
      }

      setShareInfo({
        kind: 'info',
        text: hasValidPhone
          ? 'WhatsApp dibuka untuk customer. Klik "Lampirkan Invoice" untuk simpan PNG, lalu attach di chat.'
          : 'WhatsApp dibuka. Pilih kontak, lalu klik "Lampirkan Invoice" untuk attach file PNG.',
      })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[Invoice] WhatsApp flow error:', err)
      setShareInfo({
        kind: 'error',
        text: `Gagal kirim invoice: ${err?.message || 'unknown error'}`,
      })
    } finally {
      setSharing(false)
    }
  }

  /** Save the cached PNG blob to user device for manual attach in WhatsApp. */
  const handleAttachInvoice = () => {
    if (!pendingBlob) return
    downloadFile(`Invoice-${t.invoiceNo}.png`, pendingBlob, 'image/png')
    setShareInfo({
      kind: 'success',
      text: 'Invoice PNG diunduh — tinggal attach di chat WhatsApp.',
    })
  }

  // Auto-trigger WhatsApp when component mounts with autoShare=true
  useEffect(() => {
    if (autoShare && !autoTriggered.current) {
      autoTriggered.current = true
      const id = setTimeout(() => handleWhatsApp(), 300)
      return () => clearTimeout(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoShare])

  const handleDownloadPNG = async () => {
    if (sharing) return
    setSharing(true)
    try {
      const blob = await renderInvoicePNG()
      downloadFile(`Invoice-${t.invoiceNo}.png`, blob, 'image/png')
      setShareInfo({ kind: 'success', text: 'PNG berhasil diunduh' })
    } catch (err) {
      setShareInfo({ kind: 'error', text: err.message || 'Gagal' })
    } finally {
      setSharing(false)
    }
  }

  // Status badge color
  const badgeBg = status?.color === 'green' ? 'rgba(16,217,138,0.12)'
    : status?.color === 'accent' ? 'rgba(139,92,246,0.12)'
    : status?.color === 'amber' ? 'rgba(245,158,11,0.12)'
    : 'rgba(59,130,246,0.12)'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 animate-fadeIn"
      style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
      <div className="animate-scaleIn rounded-2xl overflow-hidden w-full flex flex-col" style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-strong)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        maxWidth: 760, maxHeight: '94dvh',
      }}>
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 flex-shrink-0 gap-2"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)' }}>
              <FileText size={16} style={{ color: 'var(--accent-light)' }} />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm truncate" style={{ fontFamily: 'Syne', color: 'var(--text-primary)' }}>
                Preview Invoice
              </div>
              <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                {t.invoiceNo}
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={handleWhatsApp} disabled={sharing}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold btn-press disabled:opacity-70"
              style={{
                background: 'linear-gradient(135deg, #25d366, #128c7e)',
                color: '#fff', fontFamily: 'Syne',
                boxShadow: '0 4px 14px rgba(37,211,102,0.3)',
              }}
              title="Bagikan invoice PNG via WhatsApp">
              {sharing ? <Loader2 size={13} className="animate-spin" /> : <MessageCircle size={13} />}
              <span className="hidden sm:inline">{sharing ? 'Memproses...' : 'WhatsApp'}</span>
            </button>
            {/* Tombol "Lampirkan Invoice" muncul setelah WA dibuka di browser
                yang tidak mendukung Web Share file (fallback path). */}
            {pendingBlob && (
              <button
                onClick={handleAttachInvoice}
                disabled={sharing}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold btn-press animate-fadeIn"
                style={{
                  background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
                  color: '#fff', fontFamily: 'Syne',
                  boxShadow: '0 4px 14px rgba(245,158,11,0.35)',
                }}
                title="Simpan PNG untuk dilampirkan ke WhatsApp"
              >
                <Download size={13} />
                <span className="hidden sm:inline">Lampirkan Invoice</span>
              </button>
            )}
            <button onClick={handleDownloadPNG} disabled={sharing}
              className="flex items-center justify-center w-9 h-9 rounded-xl btn-press disabled:opacity-70"
              style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
              title="Download PNG">
              <Download size={14} />
            </button>
            <button onClick={handlePrint}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold btn-press"
              style={{
                background: 'linear-gradient(135deg, var(--accent), #6366f1)',
                color: '#fff', fontFamily: 'Syne',
                boxShadow: '0 4px 14px rgba(139,92,246,0.3)',
              }}>
              <Printer size={13} />
              <span className="hidden sm:inline">Cetak</span>
            </button>
            <button onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl btn-press flex-shrink-0"
              style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Share status */}
        {shareInfo && (
          <div className="px-5 py-2 flex-shrink-0 animate-fadeIn"
            style={{
              borderBottom: '1px solid var(--border)',
              background:
                shareInfo.kind === 'success' ? 'rgba(16,217,138,0.08)'
                : shareInfo.kind === 'error' ? 'rgba(255,77,106,0.08)'
                : 'rgba(59,130,246,0.08)',
              color:
                shareInfo.kind === 'success' ? '#10d98a'
                : shareInfo.kind === 'error' ? '#ff4d6a'
                : '#3b82f6',
            }}>
            <div className="text-xs font-semibold" style={{ fontFamily: 'Syne' }}>{shareInfo.text}</div>
          </div>
        )}

        {/* Invoice render area */}
        <div
          className="overflow-auto p-4 sm:p-8 flex justify-center"
          style={{
            background: '#1c1c28',
            // Allow horizontal scroll on mobile so user can swipe the desktop-sized invoice
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {/* IMPORTANT: this is the node captured by html2canvas.
              No `overflow: hidden`, no absolute decorations, plenty of padding. */}
          <div
            ref={printRef}
            id="invoice-print"
            style={{
              // FIXED desktop width — invoice must look identical on PC, Android, iPhone
              width: 720,
              minWidth: 720,
              background: '#ffffff',
              color: '#1a1a25',
              borderRadius: 16,
              padding: '0 40px 64px',
              fontFamily: 'DM Sans, sans-serif',
              boxShadow: '0 16px 48px rgba(0,0,0,0.25)',
              position: 'relative',
              boxSizing: 'border-box',
              wordBreak: 'normal',
              overflowWrap: 'break-word',
              flexShrink: 0,
            }}
          >
            {/* Top gradient strip — always desktop */}
            <div style={{
              height: 8,
              margin: '0 -40px 36px',
              background: 'linear-gradient(90deg, #F2E500 0%, #ffe600 50%, #d4c800 100%)',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
            }} />

            {/* Header: Logo + Invoice meta — always desktop layout */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 24,
              marginBottom: 32,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <Logo size={68} customSrc={STORE_INFO.invoiceLogo} onLight />
                <div>
                  <div style={{
                    fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 24,
                    color: '#0a0a0f', letterSpacing: '-0.02em', lineHeight: 1.1,
                  }}>
                    {STORE_INFO.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b6b80', marginTop: 3, fontStyle: 'italic' }}>
                    {STORE_INFO.tagline}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 36,
                  color: '#0a0a0f', letterSpacing: '-0.03em', lineHeight: 1,
                }}>
                  INVOICE
                </div>
                <div style={{
                  fontSize: 13, fontWeight: 700, color: '#8b5cf6',
                  marginTop: 6, fontFamily: 'DM Sans',
                }}>
                  #{t.invoiceNo}
                </div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  marginTop: 8, padding: '5px 12px', borderRadius: 999,
                  fontSize: 10, fontWeight: 700, fontFamily: 'Syne',
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  background: badgeBg, color: status?.hex || '#3b82f6',
                  border: `1px solid ${(status?.hex || '#3b82f6')}33`,
                }}>
                  {status?.label || t.status}
                </div>
              </div>
            </div>

            {/* From / To / Date cards — always 3 columns */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 14,
              marginBottom: 28,
            }}>
              <div style={{ padding: 16, borderRadius: 12, background: '#f8f8fb', border: '1px solid #ececf2' }}>
                <div style={infoLabel}>Dari</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a25', marginBottom: 6 }}>
                  {STORE_INFO.name}
                </div>
                <div style={{ fontSize: 10.5, color: '#55556a', lineHeight: 1.5 }}>
                  {STORE_INFO.address}
                </div>
                <div style={{ fontSize: 10.5, color: '#55556a', marginTop: 6 }}>
                  {STORE_INFO.phone}
                </div>
              </div>

              <div style={{ padding: 16, borderRadius: 12, background: '#f8f8fb', border: '1px solid #ececf2' }}>
                <div style={infoLabel}>Ditagihkan Kepada</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a25', marginBottom: 6 }}>
                  {(!t.customer || /^umum$/i.test(String(t.customer).trim())) ? 'Pelanggan Umum' : t.customer}
                </div>
                {t.customerPhone && (
                  <div style={{ fontSize: 10.5, color: '#55556a' }}>{t.customerPhone}</div>
                )}
                <div style={{ fontSize: 10.5, color: '#55556a', marginTop: 6 }}>Pelanggan</div>
              </div>

              <div style={{ padding: 16, borderRadius: 12, background: '#f8f8fb', border: '1px solid #ececf2' }}>
                <div style={infoLabel}>Detail</div>
                <DetailRow k="Tanggal" v={formatDateTime(t.date)} />
                <DetailRow k="Pembayaran" v={PAYMENT_LABEL[t.paymentMethod] || t.paymentMethod} />
                {/* Hanya tampil untuk Hutang / Tempo (cash/transfer/qris tidak butuh tempo) */}
                {isHutang && t.dueDate && (
                  <DetailRow
                    k="Jatuh Tempo"
                    v={new Date(t.dueDate).toLocaleDateString('id-ID', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                    })}
                  />
                )}
                {t.cashier && <DetailRow k="Kasir" v={t.cashier} />}
              </div>
            </div>

            {/* Items table */}
            <div style={{
              borderRadius: 12,
              overflow: 'visible',
              border: '1px solid #ececf2',
              marginBottom: 24,
              background: '#fff',
            }}>
              {/* Header — always 5 columns desktop */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '40px 1fr 60px 120px 130px',
                gap: 12,
                padding: '14px 18px',
                background: '#f8f8fb',
                fontSize: 11,
                fontWeight: 700,
                color: '#55556a',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                fontFamily: 'Syne',
                borderBottom: '1px solid #ececf2',
              }}>
                <span>#</span>
                <span>Produk</span>
                <span style={{ textAlign: 'center' }}>Qty</span>
                <span style={{ textAlign: 'right' }}>Harga</span>
                <span style={{ textAlign: 'right' }}>Subtotal</span>
              </div>
              {(t.items || []).map((item, i) => {
                const unit = (item.unit || 'pcs').toLowerCase()
                // qty formatted Indonesian (1,5 / 2,75 / 3)
                const qtyNum = Number(item.qty) || 0
                const qtyDisplay = (unit === 'meter' || unit === 'yard')
                  ? (Number.isInteger(qtyNum)
                      ? String(qtyNum)
                      : qtyNum.toFixed(2).replace(/\.?0+$/, '')).replace('.', ',')
                  : String(Math.round(qtyNum))
                const unitLabel = unit === 'meter' ? 'Meter' : unit === 'yard' ? 'Yard' : 'PCS'
                return (
                  <div key={i} style={{
                    display: 'grid',
                    gridTemplateColumns: '40px 1fr 60px 120px 130px',
                    gap: 12,
                    padding: '16px 18px',
                    fontSize: 12,
                    borderBottom: i < t.items.length - 1 ? '1px solid #ececf2' : 'none',
                    alignItems: 'center',
                  }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: '#8b5cf6', fontFamily: 'Syne',
                    }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span style={{
                      fontWeight: 600, color: '#1a1a25', lineHeight: 1.4,
                      wordBreak: 'normal',
                      overflowWrap: 'break-word',
                      whiteSpace: 'normal',
                    }}>
                      {item.name}
                      <span style={{
                        display: 'inline-block',
                        marginLeft: 8,
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#8b5cf6',
                        background: 'rgba(139,92,246,0.10)',
                        border: '1px solid rgba(139,92,246,0.18)',
                        fontFamily: 'Syne',
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        verticalAlign: 'middle',
                      }}>
                        {qtyDisplay} {unitLabel}
                      </span>
                    </span>
                    <span style={{
                      textAlign: 'center', color: '#1a1a25', fontFamily: 'Syne', fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {qtyDisplay}
                    </span>
                    <span style={{
                      textAlign: 'right', color: '#55556a', whiteSpace: 'nowrap',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {formatRupiah(item.price)}
                    </span>
                    <span style={{
                      textAlign: 'right', fontWeight: 700, color: '#1a1a25',
                      fontFamily: 'Syne', whiteSpace: 'nowrap',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {formatRupiah(qtyNum * item.price)}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Bank + Summary — always 2 columns desktop */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isHutang ? '1fr 1.15fr' : '1fr 1fr',
              gap: 18,
              marginBottom: 26,
            }}>
              {/* Bank card */}
              <div style={{
                padding: 18,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #f8f8fb 0%, #f1f1f5 100%)',
                border: '1px solid #ececf2',
                display: 'flex', flexDirection: 'column', justifyContent: 'center',
                minWidth: 0,
              }}>
                <div style={{ ...infoLabel, marginBottom: 10 }}>
                  Pembayaran via Transfer
                </div>
                <div style={{
                  background: '#0a0a0f',
                  color: '#fff',
                  padding: '14px 16px',
                  borderRadius: 10,
                  fontFamily: '"Bree Serif", serif',
                }}>
                  <div style={{
                    fontSize: 12.5, color: '#F2E500', letterSpacing: '0.04em',
                    fontFamily: '"Bree Serif", serif',
                  }}>
                    {STORE_INFO.bank?.name || '-'}
                  </div>
                  <div style={{
                    fontSize: 22, color: '#fff', letterSpacing: 2,
                    fontFamily: '"Bree Serif", serif', margin: '4px 0 2px',
                    wordBreak: 'break-all',
                  }}>
                    {STORE_INFO.bank?.number || '-'}
                  </div>
                  <div style={{
                    fontSize: 13, color: '#e0e0e8', fontFamily: '"Bree Serif", serif',
                  }}>
                    a.n. {STORE_INFO.bank?.holder || '-'}
                  </div>
                </div>
              </div>

              {/* Total summary — Hutang mode emphasizes SISA TAGIHAN */}
              <div style={{
                padding: 20,
                borderRadius: 12,
                background: (t.remaining || 0) > 0
                  ? 'linear-gradient(135deg, #0a0a0f 0%, #2d1a0a 100%)'   // hutang: dark + orange glow
                  : 'linear-gradient(135deg, #0a0a0f 0%, #1a0a2e 100%)',   // lunas: dark + purple
                color: '#fff',
                minWidth: 0,
                position: 'relative',
                // Use clip-path instead of overflow:hidden so html2canvas can capture full element
                clipPath: 'inset(0 round 12px)',
              }}>
                {/* Soft glow accent untuk hutang — merah halus selaras SISA TAGIHAN */}
                {(t.remaining || 0) > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: -40, right: -40,
                    width: 160, height: 160,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(239,68,68,0.22), transparent 70%)',
                    pointerEvents: 'none',
                  }} />
                )}

                <div style={{ position: 'relative' }}>
                  {/* Subtotal */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
                    <span style={{ color: '#8888a8' }}>Subtotal</span>
                    <span style={{ color: '#f0f0f8', fontWeight: 600 }}>{formatRupiah(t.subtotal)}</span>
                  </div>

                  {/* Diskon — orange/amber (pengurang harga, bukan peringatan) */}
                  {t.discount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
                      <span style={{ color: '#8888a8' }}>Diskon</span>
                      <span style={{ color: '#f59e0b', fontWeight: 600 }}>−{formatRupiah(t.discount)}</span>
                    </div>
                  )}

                  {/* Divider */}
                  <div style={{
                    height: 1,
                    background: 'rgba(255,255,255,0.1)',
                    margin: '12px 0',
                  }} />

                  {/* TOTAL — Sora ExtraBold, 10-15% smaller than before */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: (t.remaining || 0) > 0 ? 14 : 4,
                    gap: 6,
                  }}>
                    <span style={{
                      fontSize: 12, fontWeight: 700, color: '#a78bfa',
                      textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Syne',
                    }}>
                      Total
                    </span>
                    <span style={{
                      // Hutang: tegas tapi tidak dominan
                      // Lunas: tetap dominan
                      fontSize: (t.remaining || 0) > 0 ? 19 : 26,
                      fontWeight: 800,
                      color: (t.remaining || 0) > 0 ? '#e0e0e8' : '#fff',
                      fontFamily: '"Sora", "Syne", sans-serif',
                      letterSpacing: '-0.02em',
                      whiteSpace: 'nowrap',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {formatRupiah(t.total)}
                    </span>
                  </div>

                  {/* HUTANG SECTION — DP + SISA TAGIHAN (focus utama) */}
                  {(t.remaining || 0) > 0 && (
                    <>
                      <div style={{
                        height: 1,
                        background: 'rgba(239,68,68,0.22)',   // ← merah halus menyatu dgn SISA TAGIHAN
                        margin: '8px 0',
                      }} />

                      {/* DP DIBAYAR — Inter SemiBold, ukuran normal */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        marginBottom: 10,                       // ← tighter (was 14)
                      }}>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#8888a8',
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          fontFamily: 'Syne',
                        }}>
                          DP Dibayar
                        </span>
                        <span style={{
                          fontSize: 17,
                          fontWeight: 600,
                          color: '#10d98a',
                          fontFamily: '"Inter", "DM Sans", sans-serif',
                          letterSpacing: '-0.01em',
                          whiteSpace: 'nowrap',
                          fontVariantNumeric: 'tabular-nums',
                        }}>
                          {formatRupiah(t.dp || t.paid || 0)}
                        </span>
                      </div>

                      {/* Jatuh Tempo dipindah hanya ke kartu Detail (kiri atas)
                          agar panel total tetap fokus ke: Total / DP / Sisa */}

                      {/* SISA TAGIHAN — HERO BLOCK (RED EMPHASIS)
                          • Font ~ 24px = TOTAL × 1.26 (spec: 15-25% lebih besar)
                          • Warna merah agar customer langsung fokus ke nominal
                            yang harus dibayar — lebih mencolok daripada amber */}
                      <div style={{
                        background: 'linear-gradient(135deg, rgba(239,68,68,0.18), rgba(220,38,38,0.10))',
                        border: '1px solid rgba(239,68,68,0.45)',
                        borderRadius: 12,
                        padding: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'flex-start',
                        gap: 12,
                        marginTop: -2,
                        boxShadow: '0 0 24px rgba(239,68,68,0.18)',
                      }}>
                        <div style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: '#ef4444',
                          textTransform: 'uppercase',
                          letterSpacing: '0.14em',
                          fontFamily: 'Syne',
                          lineHeight: 1,
                        }}>
                          Sisa Tagihan
                        </div>
                        <div style={{
                          // ~24px = 19 × 1.26 (sesuai spec 15-25% bigger than TOTAL)
                          fontSize: 24,
                          fontWeight: 800,
                          color: '#ef4444',
                          fontFamily: '"Space Grotesk", "Sora", "Syne", sans-serif',
                          letterSpacing: '-0.02em',
                          lineHeight: 1,
                          whiteSpace: 'nowrap',
                          textShadow: '0 0 20px rgba(239,68,68,0.5)',
                          fontVariantNumeric: 'tabular-nums',
                        }}>
                          {formatRupiah(t.remaining)}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              borderTop: '2px dashed #ececf2',
              paddingTop: 20,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              gap: 18,
              flexWrap: 'wrap',
            }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={infoLabel}>Catatan</div>
                <p style={{ fontSize: 11, color: '#55556a', lineHeight: 1.7, marginBottom: 5 }}>
                  Terima kasih atas kepercayaan Anda kepada <strong>{STORE_INFO.name}</strong>.
                </p>
                <p style={{ fontSize: 11, color: '#55556a', lineHeight: 1.7, marginBottom: 5 }}>
                  Pembayaran via transfer ke <strong>{STORE_INFO.bank?.name} {STORE_INFO.bank?.number}</strong> a.n. <strong>{STORE_INFO.bank?.holder}</strong>.
                </p>
                <p style={{ fontSize: 11, color: '#55556a', lineHeight: 1.7 }}>
                  Pertanyaan &amp; konfirmasi: <strong>{STORE_INFO.phone}</strong> ({STORE_INFO.address}).
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ ...infoLabel, marginBottom: 28 }}>Tanda Tangan</div>
                <div style={{
                  borderTop: '1px solid #c5c5d0',
                  paddingTop: 6,
                  minWidth: 160,
                  fontSize: 11, fontWeight: 600, color: '#1a1a25', fontFamily: 'Syne',
                }}>
                  {STORE_INFO.name}
                </div>
              </div>
            </div>

            {/* Bottom strip */}
            <div style={{
              marginTop: 28,
              textAlign: 'center',
              fontSize: 10,
              color: '#a8a8b8',
              fontFamily: 'Syne',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}>
              ✦ Powered by {STORE_INFO.name} ✦
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const infoLabel = {
  fontSize: 10,
  fontWeight: 700,
  color: '#8888a8',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontFamily: 'Syne',
  marginBottom: 8,
}

function DetailRow({ k, v }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, marginBottom: 5 }}>
      <span style={{ color: '#8888a8' }}>{k}</span>
      <span style={{ color: '#1a1a25', fontWeight: 600, textAlign: 'right' }}>{v}</span>
    </div>
  )
}
