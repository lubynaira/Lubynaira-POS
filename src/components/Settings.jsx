import React, { useState, useEffect } from 'react'
import {
  Store, Image, Users, Lock, LogOut, ImagePlus,
  CheckCircle2, AlertCircle, UserPlus, Trash2, Crown,
  Eye, EyeOff, Loader2,
} from 'lucide-react'
import Modal from './Modal'
import { Input, Button } from './ui'
import Logo from './Logo'

const TABS = [
  { id: 'toko', label: 'Toko', icon: Store },
  { id: 'logo', label: 'Logo', icon: Image },
  { id: 'admin', label: 'Admin', icon: Users },
  { id: 'password', label: 'Password', icon: Lock },
]

function Banner({ kind = 'success', children }) {
  const map = {
    success: { bg: 'rgba(16,217,138,0.08)', color: '#10d98a', border: 'rgba(16,217,138,0.25)', Icon: CheckCircle2 },
    error: { bg: 'rgba(255,77,106,0.08)', color: '#ff4d6a', border: 'rgba(255,77,106,0.25)', Icon: AlertCircle },
  }
  const c = map[kind]
  const Icon = c.Icon
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold animate-fadeIn"
      style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      <Icon size={13} />
      {children}
    </div>
  )
}

export default function Settings({
  open, onClose,
  storeInfo, admins, currentUser, busy,
  updateStoreInfo, updateLogo,
  addAdmin, deleteAdmin, changePassword, logout,
}) {
  const [tab, setTab] = useState('toko')
  const [msg, setMsg] = useState(null)
  const [savingToko, setSavingToko] = useState(false)
  const [uploading, setUploading] = useState({ frontLogo: false, invoiceLogo: false })
  const [addingAdmin, setAddingAdmin] = useState(false)
  const [changingPass, setChangingPass] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const [tokoForm, setTokoForm] = useState({
    name: '', tagline: '', address: '', phone: '',
    bankName: '', bankNumber: '', bankHolder: '',
  })

  useEffect(() => {
    if (open && storeInfo) {
      setTokoForm({
        name: storeInfo?.name || '',
        tagline: storeInfo?.tagline || '',
        address: storeInfo?.address || '',
        phone: storeInfo?.phone || '',
        bankName: storeInfo.bank?.name || '',
        bankNumber: storeInfo.bank?.number || '',
        bankHolder: storeInfo.bank?.holder || '',
      })
      setMsg(null)
    }
  }, [open, storeInfo])

  const flash = (kind, text) => {
    setMsg({ kind, text })
    setTimeout(() => setMsg(null), 3200)
  }

  const handleSaveToko = async () => {
    setSavingToko(true)
    try {
      const res = await updateStoreInfo({
        name: tokoForm.name.trim(),
        tagline: tokoForm.tagline.trim(),
        address: tokoForm.address.trim(),
        phone: tokoForm.phone.trim(),
        bank: {
          name: tokoForm.bankName.trim(),
          number: tokoForm.bankNumber.trim(),
          holder: tokoForm.bankHolder.trim(),
        },
      })
      if (res.ok) flash('success', 'Info toko berhasil disimpan')
      else flash('error', res.error || 'Gagal menyimpan')
    } finally {
      setSavingToko(false)
    }
  }

  const handleLogoUpload = async (type, e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 2_500_000) return flash('error', 'Ukuran maksimal 2.5 MB')
    setUploading(prev => ({ ...prev, [type]: true }))
    try {
      const res = await updateLogo(type, file)
      if (res.ok) flash('success', `Logo ${type === 'frontLogo' ? 'depan' : 'invoice'} diunggah`)
      else flash('error', res.error || 'Gagal upload')
    } finally {
      setUploading(prev => ({ ...prev, [type]: false }))
    }
  }

  const handleLogoReset = async (type) => {
    setUploading(prev => ({ ...prev, [type]: true }))
    try {
      const res = await updateLogo(type, null)
      if (res.ok) flash('success', `Logo ${type === 'frontLogo' ? 'depan' : 'invoice'} dikembalikan ke default`)
      else flash('error', res.error || 'Gagal reset')
    } finally {
      setUploading(prev => ({ ...prev, [type]: false }))
    }
  }

  const [newAdmin, setNewAdmin] = useState({ username: '', name: '', password: '', role: 'staff' })

  const handleAddAdmin = async () => {
    setAddingAdmin(true)
    try {
      const res = await addAdmin(newAdmin)
      if (res.ok) {
        flash('success', `Admin "${newAdmin.username}" ditambahkan`)
        setNewAdmin({ username: '', name: '', password: '', role: 'staff' })
      } else {
        flash('error', res.error || 'Gagal menambah admin')
      }
    } finally {
      setAddingAdmin(false)
    }
  }

  const handleDeleteAdmin = async (id) => {
    setDeletingId(id)
    try {
      const res = await deleteAdmin(id)
      if (res.ok) flash('success', 'Admin dihapus')
      else flash('error', res.error || 'Gagal menghapus')
    } finally {
      setDeletingId(null)
    }
  }

  const [passForm, setPassForm] = useState({ old: '', new1: '', new2: '' })
  const [showPass, setShowPass] = useState(false)

  const handleChangePass = async () => {
    if (passForm.new1 !== passForm.new2) return flash('error', 'Password baru tidak cocok')
    setChangingPass(true)
    try {
      const res = await changePassword(passForm.old, passForm.new1)
      if (res.ok) {
        flash('success', 'Password berhasil diubah')
        setPassForm({ old: '', new1: '', new2: '' })
      } else {
        flash('error', res.error || 'Gagal mengubah password')
      }
    } finally {
      setChangingPass(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Pengaturan"
      subtitle={`Login sebagai ${currentUser?.name || currentUser?.username || '—'}`}
      size="lg"
    >
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex sm:flex-col gap-1 sm:w-44 flex-shrink-0 overflow-x-auto sm:overflow-visible no-scrollbar">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all flex-shrink-0 sm:flex-shrink-1"
                style={{
                  background: active ? 'rgba(139,92,246,0.12)' : 'transparent',
                  color: active ? 'var(--accent-light)' : 'var(--text-secondary)',
                  border: `1px solid ${active ? 'rgba(139,92,246,0.3)' : 'transparent'}`,
                  fontFamily: 'Syne',
                }}
              >
                <Icon size={15} />
                {label}
              </button>
            )
          })}
          <button
            onClick={logout}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all sm:mt-auto sm:mb-0 flex-shrink-0"
            style={{
              background: 'rgba(255,77,106,0.08)',
              color: 'var(--red)',
              border: '1px solid rgba(255,77,106,0.2)',
              fontFamily: 'Syne',
            }}
          >
            <LogOut size={15} />
            Logout
          </button>
        </div>

        <div className="flex-1 min-w-0">
          {msg && <div className="mb-3"><Banner kind={msg.kind}>{msg.text}</Banner></div>}

          {/* === TOKO === */}
          {tab === 'toko' && (
            <div className="space-y-3 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label="Nama Toko" value={tokoForm.name}
                  onChange={e => setTokoForm(p => ({ ...p, name: e.target.value }))} />
                <Input label="Tagline" value={tokoForm.tagline}
                  onChange={e => setTokoForm(p => ({ ...p, tagline: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5"
                  style={{ color: 'var(--text-secondary)', fontFamily: 'Syne' }}>
                  Alamat Lengkap
                </label>
                <textarea
                  rows={3}
                  value={tokoForm.address}
                  onChange={e => setTokoForm(p => ({ ...p, address: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm transition-all resize-none"
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    fontFamily: 'DM Sans',
                  }}
                />
              </div>
              <Input label="Nomor HP / Telepon" value={tokoForm.phone}
                onChange={e => setTokoForm(p => ({ ...p, phone: e.target.value }))} />

              <div className="rounded-xl p-4"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div className="text-xs font-semibold mb-3"
                  style={{ color: 'var(--accent-light)', fontFamily: 'Syne', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  🏦 Rekening Bank
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Nama Bank" value={tokoForm.bankName}
                      onChange={e => setTokoForm(p => ({ ...p, bankName: e.target.value }))} placeholder="Bank BCA" />
                    <Input label="No Rekening" value={tokoForm.bankNumber}
                      onChange={e => setTokoForm(p => ({ ...p, bankNumber: e.target.value }))} placeholder="2064447555" />
                  </div>
                  <Input label="Atas Nama" value={tokoForm.bankHolder}
                    onChange={e => setTokoForm(p => ({ ...p, bankHolder: e.target.value }))} placeholder="Nama pemilik rekening" />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button variant="primary" onClick={handleSaveToko} disabled={savingToko}>
                  {savingToko ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  {savingToko ? 'Menyimpan...' : 'Simpan Perubahan'}
                </Button>
              </div>
            </div>
          )}

          {/* === LOGO === */}
          {tab === 'logo' && (
            <div className="space-y-4 animate-fadeIn">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Logo di-upload ke Supabase Storage (bucket <code style={{ color: 'var(--accent-light)' }}>logos</code>).
                Format PNG/JPG, max 2.5 MB.
              </p>

              {[
                { type: 'frontLogo', title: 'Logo Tampilan Depan', desc: 'Muncul di sidebar, login, dan dashboard', onLight: false },
                { type: 'invoiceLogo', title: 'Logo Invoice', desc: 'Muncul di header invoice cetak', onLight: true },
              ].map(({ type, title, desc, onLight }) => (
                <div key={type} className="rounded-xl p-4"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between mb-3 gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-bold" style={{ fontFamily: 'Syne', color: 'var(--text-primary)' }}>
                        {title}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{desc}</div>
                    </div>
                    <div className="rounded-xl p-2 flex-shrink-0"
                      style={{ background: onLight ? '#fff' : 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                      <Logo size={56} customSrc={storeInfo?.[type]} onLight={onLight} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <label
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold btn-press ${uploading[type] ? 'cursor-wait opacity-60' : 'cursor-pointer'}`}
                      style={{
                        background: 'linear-gradient(135deg, var(--accent), #6366f1)',
                        color: '#fff', fontFamily: 'Syne',
                      }}
                    >
                      {uploading[type] ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          Mengunggah...
                        </>
                      ) : (
                        <>
                          <ImagePlus size={13} />
                          Upload {title}
                        </>
                      )}
                      <input type="file" accept="image/*" className="hidden"
                        disabled={uploading[type]}
                        onChange={e => handleLogoUpload(type, e)} />
                    </label>
                    {storeInfo?.[type] && (
                      <button
                        onClick={() => handleLogoReset(type)}
                        disabled={uploading[type]}
                        className="px-3 py-2.5 rounded-xl text-xs font-semibold btn-press disabled:opacity-50"
                        style={{
                          background: 'rgba(255,77,106,0.1)',
                          color: 'var(--red)',
                          border: '1px solid rgba(255,77,106,0.2)',
                          fontFamily: 'Syne',
                        }}
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* === ADMIN === */}
          {tab === 'admin' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="space-y-2">
                {admins.map(a => {
                  const isMe = currentUser?.id === a.id
                  const isOwner = a.role === 'owner'
                  const isDeleting = deletingId === a.id
                  return (
                    <div key={a.id}
                      className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{
                          background: isOwner
                            ? 'linear-gradient(135deg, #f59e0b, #ea580c)'
                            : 'linear-gradient(135deg, var(--accent), #6366f1)',
                          color: '#fff', fontFamily: 'Syne',
                        }}>
                        {(a.username || '?')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold truncate"
                            style={{ color: 'var(--text-primary)' }}>
                            {a.name || a.username}
                          </span>
                          {isOwner && <Crown size={11} style={{ color: '#f59e0b' }} />}
                          {isMe && (
                            <span className="text-xs px-1.5 py-0.5 rounded font-semibold"
                              style={{ background: 'rgba(16,217,138,0.12)', color: '#10d98a', fontFamily: 'Syne' }}>
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          @{a.username} · {a.role}
                        </div>
                      </div>
                      {!isMe && (
                        <button
                          onClick={() => handleDeleteAdmin(a.id)}
                          disabled={isDeleting}
                          className="w-8 h-8 rounded-lg flex items-center justify-center btn-press disabled:opacity-60"
                          style={{
                            background: 'rgba(255,77,106,0.08)',
                            color: 'var(--red)',
                            border: '1px solid rgba(255,77,106,0.15)',
                          }}
                        >
                          {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="rounded-xl p-4"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div className="text-xs font-semibold mb-3"
                  style={{ color: 'var(--accent-light)', fontFamily: 'Syne', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  ➕ Tambah Admin Baru
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <Input label="Username" value={newAdmin.username}
                    onChange={e => setNewAdmin(p => ({ ...p, username: e.target.value }))}
                    placeholder="cth: kasir1" />
                  <Input label="Nama Lengkap" value={newAdmin.name}
                    onChange={e => setNewAdmin(p => ({ ...p, name: e.target.value }))}
                    placeholder="Nama tampilan" />
                  <Input label="Password" type="password" value={newAdmin.password}
                    onChange={e => setNewAdmin(p => ({ ...p, password: e.target.value }))}
                    placeholder="min 4 karakter" />
                  <div>
                    <label className="block text-xs font-semibold mb-1.5"
                      style={{ color: 'var(--text-secondary)', fontFamily: 'Syne' }}>
                      Role
                    </label>
                    <select
                      value={newAdmin.role}
                      onChange={e => setNewAdmin(p => ({ ...p, role: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl text-sm"
                      style={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <option value="staff">Staff Kasir</option>
                      <option value="owner">Owner</option>
                    </select>
                  </div>
                </div>
                <Button variant="primary" className="w-full" onClick={handleAddAdmin} disabled={addingAdmin}>
                  {addingAdmin ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                  {addingAdmin ? 'Menyimpan...' : 'Tambah Admin'}
                </Button>
              </div>
            </div>
          )}

          {/* === PASSWORD === */}
          {tab === 'password' && (
            <div className="space-y-3 animate-fadeIn">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Ganti password untuk akun <strong style={{ color: 'var(--text-primary)' }}>{currentUser?.username}</strong>.
              </p>
              <div>
                <label className="block text-xs font-semibold mb-1.5"
                  style={{ color: 'var(--text-secondary)', fontFamily: 'Syne' }}>
                  Password Lama
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={passForm.old}
                    onChange={e => setPassForm(p => ({ ...p, old: e.target.value }))}
                    className="w-full px-3 py-2.5 pr-10 rounded-xl text-sm"
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <button type="button" onClick={() => setShowPass(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--text-muted)' }}>
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <Input label="Password Baru" type={showPass ? 'text' : 'password'}
                value={passForm.new1}
                onChange={e => setPassForm(p => ({ ...p, new1: e.target.value }))}
                placeholder="min 4 karakter" />
              <Input label="Konfirmasi Password Baru" type={showPass ? 'text' : 'password'}
                value={passForm.new2}
                onChange={e => setPassForm(p => ({ ...p, new2: e.target.value }))}
                placeholder="ulangi password baru" />
              <div className="pt-2">
                <Button variant="primary" className="w-full" onClick={handleChangePass} disabled={changingPass}>
                  {changingPass ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                  {changingPass ? 'Menyimpan...' : 'Ganti Password'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
