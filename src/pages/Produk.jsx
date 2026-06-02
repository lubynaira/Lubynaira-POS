import React, { useState, useMemo } from 'react'
import {
  Plus, Search, Edit2, Trash2, Package, X, ImagePlus,
} from 'lucide-react'
import { CATEGORIES } from '../data/dummyData'
import { formatRupiah, toBase64 } from '../utils/helpers'
import { Input, Select, Textarea, Button, Badge, ProductImage, EmptyState } from '../components/ui'
import Modal from '../components/Modal'

const EMPTY_FORM = {
  name: '', category: 'jersey', price: '', modal: '',
  unit: 'pcs',
  description: '', image: '',
}

const UNIT_OPTIONS = [
  { id: 'pcs',   label: 'PCS',   icon: '📦' },
  { id: 'meter', label: 'Meter', icon: '📏' },
  { id: 'yard',  label: 'Yard',  icon: '🧵' },
]

const CAT_COLOR = {
  jersey: 'blue', dtf: 'accent', sablon: 'amber',
  kaos: 'green', hoodie: 'accent', banner: 'red',
}

export default function Produk({ products, addProduct, updateProduct, deleteProduct, busy }) {
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchCat = filterCat === 'all' || p.category === filterCat
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
      return matchCat && matchSearch
    })
  }, [products, search, filterCat])


  const openAdd = () => {
    setEditId(null)
    setForm(EMPTY_FORM)
    setImagePreview('')
    setErrors({})
    setModalOpen(true)
  }

  const openEdit = (p) => {
    setEditId(p.id)
    setForm({
      name: p.name,
      category: p.category,
      price: p.price,
      modal: p.modal,
      unit: p.unit || 'pcs',
      description: p.description || '',
      image: p.image || '',
    })
    setImagePreview(p.image || '')
    setErrors({})
    setModalOpen(true)
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 4_000_000) {
      alert('Ukuran maksimal 4MB')
      return
    }
    const b64 = await toBase64(file)
    setImagePreview(b64)
    setForm((prev) => ({ ...prev, image: b64 }))
  }

  const validate = () => {
    const errs = {}
    if (!form.name?.trim()) errs.name = 'Nama wajib diisi'
    if (!form.price || Number(form.price) <= 0) errs.price = 'Harga harus > 0'
    if (Number(form.modal) < 0) errs.modal = 'Modal tidak valid'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSave = async () => {
    if (!validate() || saving) return
    setSaving(true)
    setSubmitError('')
    try {
      const data = {
        ...form,
        name: form.name.trim(),
        price: Number(form.price),
        modal: Number(form.modal) || 0,
        // Stok default 0 saat tambah; editing tetap pakai existing stock
        stock: editId ? (products.find(p => p.id === editId)?.stock || 0) : 0,
        unit: form.unit || 'pcs',
        image: form.image ||
          'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80',
      }
      const res = editId ? await updateProduct(editId, data) : await addProduct(data)
      if (!res.ok) {
        setSubmitError(res.error || 'Gagal menyimpan')
        return
      }
      setModalOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (deleting) return
    setDeleting(true)
    try {
      const res = await deleteProduct(id)
      if (res.ok) setDeleteConfirm(null)
      else setSubmitError(res.error || 'Gagal menghapus')
    } finally {
      setDeleting(false)
    }
  }

  const catLabels = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]))
  const margin = (p) =>
    p.modal > 0 && p.price > 0 ? Math.round(((p.price - p.modal) / p.price) * 100) : 0

  return (
    <div className="flex-1 overflow-y-auto mesh-bg">
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Manajemen Produk
            </div>
            <h2 className="text-xl sm:text-2xl font-bold mt-0.5"
              style={{ fontFamily: 'Syne', color: 'var(--text-primary)' }}>
              {products.length} produk terdaftar
            </h2>
          </div>
          <Button variant="primary" onClick={openAdd}>
            <Plus size={15} />
            Tambah Produk
          </Button>
        </div>

        {/* Search + Filter */}
        <div className="flex gap-3 mb-5 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari produk..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setFilterCat(c.id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                style={{
                  background: filterCat === c.id
                    ? 'linear-gradient(135deg, var(--accent), #6366f1)'
                    : 'var(--bg-card)',
                  color: filterCat === c.id ? '#fff' : 'var(--text-secondary)',
                  border: `1px solid ${filterCat === c.id ? 'transparent' : 'var(--border)'}`,
                  fontFamily: 'Syne',
                  boxShadow: filterCat === c.id ? '0 2px 12px rgba(139,92,246,0.3)' : 'none',
                }}
              >
                <span>{c.icon}</span> {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Tidak ada produk"
            description="Mulai dengan menambahkan produk pertama Anda"
            action={
              <Button variant="primary" size="sm" onClick={openAdd}>
                <Plus size={13} /> Tambah Sekarang
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((p, idx) => (
              <div
                key={p.id}
                className="product-card rounded-2xl overflow-hidden animate-fadeIn"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  animationDelay: `${idx * 30}ms`,
                }}
              >
                <div className="relative aspect-video">
                  <ProductImage
                    src={p.image}
                    alt={p.name}
                    className="w-full h-full object-cover"
                    fallbackSize={80}
                  />
                  <div className="absolute top-2 left-2">
                    <Badge color={CAT_COLOR[p.category] || 'accent'}>
                      {catLabels[p.category]?.icon} {catLabels[p.category]?.label}
                    </Badge>
                  </div>
                  {/* Unit badge top-right */}
                  <div className="absolute top-2 right-2">
                    <Badge color="gray">
                      {p.unit === 'meter' ? '📏 / m' : p.unit === 'yard' ? '🧵 / yd' : '📦 / pcs'}
                    </Badge>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-sm mb-2 leading-tight line-clamp-2"
                    style={{ color: 'var(--text-primary)', minHeight: 36 }}>
                    {p.name}
                  </h3>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-base"
                      style={{ color: 'var(--accent-light)', fontFamily: 'Syne' }}>
                      {formatRupiah(p.price)}
                    </span>
                    {margin(p) > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-lg font-semibold"
                        style={{
                          background: 'rgba(16,217,138,0.1)',
                          color: '#10d98a',
                          border: '1px solid rgba(16,217,138,0.2)',
                          fontFamily: 'Syne',
                        }}>
                        {margin(p)}%
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between text-xs mb-3"
                    style={{ color: 'var(--text-muted)' }}>
                    <span>Modal: {formatRupiah(p.modal)}</span>
                    <span>
                      Satuan: <strong style={{ color: 'var(--text-secondary)' }}>
                        {p.unit === 'meter' ? 'Meter' : p.unit === 'yard' ? 'Yard' : 'PCS'}
                      </strong>
                    </span>
                  </div>
                  {p.description && (
                    <p className="text-xs mb-3 line-clamp-2"
                      style={{ color: 'var(--text-muted)' }}>
                      {p.description}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(p)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold btn-press"
                      style={{
                        background: 'rgba(139,92,246,0.1)',
                        color: 'var(--accent-light)',
                        border: '1px solid rgba(139,92,246,0.2)',
                        fontFamily: 'Syne',
                      }}
                    >
                      <Edit2 size={12} /> Edit
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(p)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold btn-press"
                      style={{
                        background: 'rgba(255,77,106,0.1)',
                        color: 'var(--red)',
                        border: '1px solid rgba(255,77,106,0.2)',
                        fontFamily: 'Syne',
                      }}
                    >
                      <Trash2 size={12} /> Hapus
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Product Form Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'Edit Produk' : 'Tambah Produk Baru'}
        subtitle={editId ? 'Perbarui informasi produk' : 'Lengkapi detail produk di bawah'}
        size="md"
      >
        <div className="space-y-4">
          {/* Image Upload */}
          <div>
            <label className="block text-xs font-semibold mb-2"
              style={{ color: 'var(--text-secondary)', fontFamily: 'Syne' }}>
              Foto Produk
            </label>
            {imagePreview ? (
              <div className="relative rounded-xl overflow-hidden aspect-video w-full mb-2">
                <ProductImage
                  src={imagePreview}
                  alt="preview"
                  className="w-full h-full object-cover"
                  fallbackSize={80}
                />
                <button
                  onClick={() => {
                    setImagePreview('')
                    setForm((p) => ({ ...p, image: '' }))
                  }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <>
                <label
                  className="flex flex-col items-center justify-center gap-2 h-32 rounded-xl cursor-pointer transition-all"
                  style={{
                    background: 'var(--bg-card)',
                    border: '2px dashed var(--border)',
                  }}
                >
                  <ImagePlus size={26} style={{ color: 'var(--text-muted)' }} />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Klik untuk upload foto
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
                    PNG, JPG · max 4MB
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </label>
                <div className="mt-2">
                  <input
                    value={form.image}
                    onChange={(e) => {
                      setForm((p) => ({ ...p, image: e.target.value }))
                      setImagePreview(e.target.value)
                    }}
                    placeholder="atau paste URL gambar..."
                    className="w-full px-3 py-2 rounded-xl text-xs"
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
              </>
            )}
          </div>

          <Input
            label="Nama Produk"
            required
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="cth: Jersey Sublimasi Full Print"
          />
          {errors.name && (
            <p className="text-xs -mt-3" style={{ color: 'var(--red)' }}>{errors.name}</p>
          )}

          <Select
            label="Kategori"
            required
            value={form.category}
            onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
          >
            {CATEGORIES.filter((c) => c.id !== 'all').map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.label}
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Input
                label="Harga Jual"
                required
                type="number"
                value={form.price}
                onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                placeholder="0"
                prefix="Rp"
              />
              {errors.price && (
                <p className="text-xs mt-1" style={{ color: 'var(--red)' }}>{errors.price}</p>
              )}
            </div>
            <div>
              <Input
                label="Harga Modal"
                type="number"
                value={form.modal}
                onChange={(e) => setForm((p) => ({ ...p, modal: e.target.value }))}
                placeholder="0"
                prefix="Rp"
              />
            </div>
          </div>

          {/* Unit/Satuan selector */}
          <div>
            <label className="block text-xs font-semibold mb-2"
              style={{ color: 'var(--text-secondary)', fontFamily: 'Syne' }}>
              Tipe Satuan <span style={{ color: 'var(--red)' }}>*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {UNIT_OPTIONS.map((u) => {
                const active = form.unit === u.id
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, unit: u.id }))}
                    className="flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-semibold transition-all"
                    style={{
                      background: active
                        ? 'linear-gradient(135deg, var(--accent), #6366f1)'
                        : 'var(--bg-card)',
                      color: active ? '#fff' : 'var(--text-secondary)',
                      border: `1px solid ${active ? 'transparent' : 'var(--border)'}`,
                      fontFamily: 'Syne',
                    }}>
                    <span className="text-base">{u.icon}</span>
                    {u.label}
                  </button>
                )
              })}
            </div>
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
              {form.unit === 'pcs'
                ? 'Dijual per biji (qty bulat).'
                : `Dijual per ${form.unit === 'meter' ? 'meter (mendukung desimal 1,5 m)' : 'yard (mendukung desimal 2,75 yd)'}.`}
            </p>
          </div>

          <Textarea
            label="Deskripsi"
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            placeholder="Deskripsi produk..."
          />

          {submitError && (
            <div className="px-3 py-2 rounded-xl text-xs font-semibold"
              style={{
                background: 'rgba(255,77,106,0.08)', color: '#ff4d6a',
                border: '1px solid rgba(255,77,106,0.25)',
              }}>
              ⚠️ {submitError}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1"
              onClick={() => setModalOpen(false)} disabled={saving}>
              Batal
            </Button>
            <Button variant="primary" className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Menyimpan...
                </>
              ) : (editId ? 'Simpan Perubahan' : 'Tambah Produk')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Hapus Produk"
        size="sm"
      >
        <div className="text-center py-2">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{
              background: 'rgba(255,77,106,0.12)',
              border: '2px solid rgba(255,77,106,0.3)',
            }}
          >
            <Trash2 size={24} style={{ color: 'var(--red)' }} />
          </div>
          <h3 className="font-bold text-base mb-2"
            style={{ fontFamily: 'Syne', color: 'var(--text-primary)' }}>
            Yakin ingin menghapus?
          </h3>
          <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
            "<strong>{deleteConfirm?.name}</strong>" akan dihapus permanen.
          </p>
          <p className="text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
            Tindakan ini tidak dapat dibatalkan.
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1"
              onClick={() => setDeleteConfirm(null)} disabled={deleting}>
              Batal
            </Button>
            <Button variant="danger" className="flex-1"
              onClick={() => handleDelete(deleteConfirm.id)} disabled={deleting}>
              {deleting ? 'Menghapus...' : 'Ya, Hapus'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
