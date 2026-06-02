import React, { useMemo, useState } from 'react'
import {
  Search, Plus, Edit2, Trash2, Users, Phone, Mail, MapPin,
  Receipt, Wallet, Crown, X, AlertTriangle, Loader2,
} from 'lucide-react'
import { Input, Button, Badge, EmptyState } from '../components/ui'
import Modal from '../components/Modal'
import WhatsAppButton from '../components/WhatsAppButton'
import { formatRupiah, formatDate, timeAgo } from '../utils/helpers'
import { TEMPLATES } from '../utils/whatsapp'
import { useToast } from '../components/Toast'

const EMPTY = { name: '', phone: '', whatsapp: '', address: '', email: '', notes: '' }

export default function Customers({
  customers, transactions, storeInfo,
  addCustomer, updateCustomer, deleteCustomer,
}) {
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all') // all | debt | lunas
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [delTarget, setDelTarget] = useState(null)
  const [detail, setDetail] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return customers.filter(c => {
      const matchQ = !q || c.name.toLowerCase().includes(q) || c.phone.includes(q) || (c.whatsapp || '').includes(q)
      const matchFilter =
        filter === 'all' ? true :
        filter === 'debt' ? c.totalDebt > 0 :
        c.totalDebt === 0
      return matchQ && matchFilter
    })
  }, [customers, search, filter])

  const totalSpent = customers.reduce((s, c) => s + c.totalSpent, 0)
  const totalDebt = customers.reduce((s, c) => s + c.totalDebt, 0)
  const debtorCount = customers.filter(c => c.totalDebt > 0).length

  const openAdd = () => { setEditId(null); setForm(EMPTY); setModalOpen(true) }
  const openEdit = (c) => {
    setEditId(c.id)
    setForm({
      name: c.name || '', phone: c.phone || '', whatsapp: c.whatsapp || c.phone || '',
      address: c.address || '', email: c.email || '', notes: c.notes || '',
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (saving) return
    if (!form.name.trim()) return toast.error('Nama wajib diisi')
    setSaving(true)
    try {
      const data = {
        ...form,
        name: form.name.trim(),
        phone: form.phone.trim(),
        whatsapp: (form.whatsapp || form.phone).trim(),
      }
      const res = editId ? await updateCustomer(editId, data) : await addCustomer(data)
      if (res.ok) {
        toast.success(editId ? 'Customer diperbarui' : 'Customer ditambahkan')
        setModalOpen(false)
      } else {
        toast.error(res.error || 'Gagal menyimpan')
      }
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!delTarget || deleting) return
    setDeleting(true)
    try {
      const res = await deleteCustomer(delTarget.id)
      if (res.ok) { toast.success('Customer dihapus'); setDelTarget(null) }
      else toast.error(res.error || 'Gagal menghapus')
    } finally { setDeleting(false) }
  }

  const customerTrx = (id) => transactions.filter(t => t.customerId === id)

  return (
    <div className="flex-1 overflow-y-auto mesh-bg">
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div>
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Customer Database</div>
            <h2 className="text-xl sm:text-2xl font-bold mt-0.5"
              style={{ fontFamily: 'Syne', color: 'var(--text-primary)' }}>
              {customers.length} pelanggan terdaftar
            </h2>
          </div>
          <Button variant="primary" onClick={openAdd}>
            <Plus size={15} /> Tambah Customer
          </Button>
        </div>

        {/* Stat strips */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Total Belanja</p>
            <p className="text-sm sm:text-base font-bold truncate" style={{ color: 'var(--accent-light)', fontFamily: 'Syne' }}>
              {formatRupiah(totalSpent)}
            </p>
          </div>
          <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Total Hutang</p>
            <p className="text-sm sm:text-base font-bold" style={{ color: '#f59e0b', fontFamily: 'Syne' }}>
              {formatRupiah(totalDebt)}
            </p>
          </div>
          <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Customer Hutang</p>
            <p className="text-sm sm:text-base font-bold" style={{ color: '#ff4d6a', fontFamily: 'Syne' }}>
              {debtorCount} orang
            </p>
          </div>
        </div>

        {/* Search + Filter */}
        <div className="flex gap-3 mb-5 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, telepon, WhatsApp..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>
          <div className="flex gap-2">
            {[
              { id: 'all', label: 'Semua' },
              { id: 'debt', label: 'Punya Hutang' },
              { id: 'lunas', label: 'Lunas' },
            ].map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)}
                className="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: filter === f.id ? 'linear-gradient(135deg, var(--accent), #6366f1)' : 'var(--bg-card)',
                  color: filter === f.id ? '#fff' : 'var(--text-secondary)',
                  border: `1px solid ${filter === f.id ? 'transparent' : 'var(--border)'}`,
                  fontFamily: 'Syne',
                }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Belum ada customer"
            description="Tambahkan customer pertama Anda untuk mulai melacak transaksi & hutang"
            action={<Button variant="primary" size="sm" onClick={openAdd}><Plus size={13} /> Tambah</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((c, idx) => {
              const phoneForWA = c.whatsapp || c.phone
              return (
                <div key={c.id}
                  className="rounded-2xl p-4 animate-fadeIn relative"
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    animationDelay: `${idx * 30}ms`,
                  }}>
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold"
                      style={{
                        background: c.totalDebt > 0
                          ? 'linear-gradient(135deg, #f59e0b, #ea580c)'
                          : 'linear-gradient(135deg, var(--accent), #6366f1)',
                        color: '#fff', fontFamily: 'Syne',
                      }}>
                      {(c.name || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)', fontFamily: 'Syne' }}>
                          {c.name}
                        </p>
                        {c.totalDebt > 0
                          ? <Badge color="amber">Hutang</Badge>
                          : c.totalTransactions > 0 ? <Badge color="green">Lunas</Badge> : <Badge color="gray">Baru</Badge>}
                      </div>
                      {c.phone && (
                        <p className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                          <Phone size={10} /> {c.phone}
                        </p>
                      )}
                      {c.address && (
                        <p className="text-xs truncate flex items-center gap-1 mt-0.5"
                          style={{ color: 'var(--text-muted)' }}>
                          <MapPin size={10} /> {c.address}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                    <div className="rounded-lg p-2" style={{ background: 'var(--bg-elevated)' }}>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Trx</p>
                      <p className="text-sm font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Syne' }}>
                        {c.totalTransactions}
                      </p>
                    </div>
                    <div className="rounded-lg p-2" style={{ background: 'var(--bg-elevated)' }}>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Belanja</p>
                      <p className="text-xs font-bold truncate" style={{ color: 'var(--accent-light)', fontFamily: 'Syne' }}>
                        {formatRupiah(c.totalSpent)}
                      </p>
                    </div>
                    <div className="rounded-lg p-2" style={{ background: 'var(--bg-elevated)' }}>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Hutang</p>
                      <p className="text-xs font-bold truncate"
                        style={{ color: c.totalDebt > 0 ? 'var(--amber)' : 'var(--text-secondary)', fontFamily: 'Syne' }}>
                        {formatRupiah(c.totalDebt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-1.5">
                    <WhatsAppButton
                      phone={phoneForWA}
                      text={TEMPLATES.chat({ name: c.name, storeName: storeInfo?.name })}
                      size="sm"
                      variant="icon"
                      tooltip="Chat Customer"
                    />
                    <button onClick={() => setDetail(c)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-xs font-semibold btn-press"
                      style={{
                        background: 'rgba(139,92,246,0.1)', color: 'var(--accent-light)',
                        border: '1px solid rgba(139,92,246,0.2)', fontFamily: 'Syne',
                      }}>
                      <Receipt size={11} /> Detail
                    </button>
                    <button onClick={() => openEdit(c)}
                      className="w-7 h-7 rounded-xl flex items-center justify-center btn-press"
                      style={{
                        background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)',
                        border: '1px solid var(--border)',
                      }} title="Edit">
                      <Edit2 size={11} />
                    </button>
                    <button onClick={() => setDelTarget(c)}
                      className="w-7 h-7 rounded-xl flex items-center justify-center btn-press"
                      style={{
                        background: 'rgba(255,77,106,0.08)', color: 'var(--red)',
                        border: '1px solid rgba(255,77,106,0.15)',
                      }} title="Hapus">
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Form Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editId ? 'Edit Customer' : 'Tambah Customer Baru'}
        subtitle={editId ? 'Perbarui data customer' : 'Isi data customer di bawah'}
        size="md">
        <div className="space-y-3">
          <Input label="Nama Lengkap" required value={form.name}
            onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="cth: Budi Santoso" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Nomor HP" value={form.phone}
              onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))}
              placeholder="081xxxxxxxxx" />
            <Input label="Nomor WhatsApp" value={form.whatsapp}
              onChange={(e) => setForm(p => ({ ...p, whatsapp: e.target.value }))}
              placeholder="kosongkan jika sama dengan HP" />
          </div>
          <Input label="Email" type="email" value={form.email}
            onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
            placeholder="email@contoh.com" />
          <div>
            <label className="block text-xs font-semibold mb-1.5"
              style={{ color: 'var(--text-secondary)', fontFamily: 'Syne' }}>
              Alamat
            </label>
            <textarea rows={2} value={form.address}
              onChange={(e) => setForm(p => ({ ...p, address: e.target.value }))}
              placeholder="Alamat lengkap..."
              className="w-full px-3 py-2.5 rounded-xl text-sm resize-none"
              style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', fontFamily: 'DM Sans',
              }} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5"
              style={{ color: 'var(--text-secondary)', fontFamily: 'Syne' }}>
              Catatan
            </label>
            <textarea rows={2} value={form.notes}
              onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Catatan internal (opsional)"
              className="w-full px-3 py-2.5 rounded-xl text-sm resize-none"
              style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', fontFamily: 'DM Sans',
              }} />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setModalOpen(false)} disabled={saving}>
              Batal
            </Button>
            <Button variant="primary" className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {saving ? 'Menyimpan...' : (editId ? 'Simpan Perubahan' : 'Tambah Customer')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!delTarget} onClose={() => setDelTarget(null)} title="Hapus Customer" size="sm">
        <div className="text-center py-2">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(255,77,106,0.12)', border: '2px solid rgba(255,77,106,0.3)' }}>
            <AlertTriangle size={24} style={{ color: 'var(--red)' }} />
          </div>
          <h3 className="font-bold text-base mb-2"
            style={{ fontFamily: 'Syne', color: 'var(--text-primary)' }}>
            Hapus {delTarget?.name}?
          </h3>
          <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
            Histori transaksi customer akan tetap ada, namun referensi nama akan terlepas.
          </p>
          {delTarget?.totalDebt > 0 && (
            <div className="mb-4 px-3 py-2 rounded-xl text-xs"
              style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>
              ⚠️ Customer ini masih punya hutang {formatRupiah(delTarget.totalDebt)}
            </div>
          )}
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setDelTarget(null)} disabled={deleting}>Batal</Button>
            <Button variant="danger" className="flex-1" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Menghapus...' : 'Ya, Hapus'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Detail / History */}
      <Modal open={!!detail} onClose={() => setDetail(null)}
        title={detail?.name || 'Detail Customer'}
        subtitle={detail ? `Customer sejak ${formatDate(detail.createdAt)}` : ''}
        size="lg">
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl p-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Total Transaksi</p>
                <p className="text-lg font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Syne' }}>
                  {detail.totalTransactions}
                </p>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Total Belanja</p>
                <p className="text-sm font-bold truncate" style={{ color: 'var(--accent-light)', fontFamily: 'Syne' }}>
                  {formatRupiah(detail.totalSpent)}
                </p>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Sisa Hutang</p>
                <p className="text-sm font-bold"
                  style={{ color: detail.totalDebt > 0 ? 'var(--amber)' : 'var(--text-secondary)', fontFamily: 'Syne' }}>
                  {formatRupiah(detail.totalDebt)}
                </p>
              </div>
            </div>

            {/* Contact strip */}
            <div className="rounded-xl p-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div className="space-y-1.5 text-xs">
                {detail.phone && (<div><Phone size={11} className="inline mr-1" style={{ color: 'var(--text-muted)' }} /> <span style={{ color: 'var(--text-secondary)' }}>{detail.phone}</span></div>)}
                {detail.email && (<div><Mail size={11} className="inline mr-1" style={{ color: 'var(--text-muted)' }} /> <span style={{ color: 'var(--text-secondary)' }}>{detail.email}</span></div>)}
                {detail.address && (<div><MapPin size={11} className="inline mr-1" style={{ color: 'var(--text-muted)' }} /> <span style={{ color: 'var(--text-secondary)' }}>{detail.address}</span></div>)}
              </div>
              <div className="flex gap-2 mt-3 flex-wrap">
                <WhatsAppButton phone={detail.whatsapp || detail.phone}
                  text={TEMPLATES.chat({ name: detail.name, storeName: storeInfo?.name })}
                  variant="pill" label="Chat Customer" showCopy size="sm" />
                {detail.totalDebt > 0 && (
                  <WhatsAppButton phone={detail.whatsapp || detail.phone}
                    text={TEMPLATES.reminder({ name: detail.name, remaining: detail.totalDebt })}
                    variant="pill" label="Reminder Hutang" size="sm"
                    className="!bg-amber-500/15 !text-amber-400 !border-amber-500/30"
                    tooltip="Kirim pengingat hutang" />
                )}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold mb-2"
                style={{ color: 'var(--text-muted)', fontFamily: 'Syne', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Histori Transaksi ({customerTrx(detail.id).length})
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {customerTrx(detail.id).length === 0 ? (
                  <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>
                    Belum ada transaksi
                  </p>
                ) : customerTrx(detail.id).map(t => (
                  <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <Receipt size={14} style={{ color: 'var(--accent-light)' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate"
                        style={{ color: 'var(--accent-light)', fontFamily: 'Syne' }}>
                        {t.invoiceNo}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {timeAgo(t.date)} · {t.items.length} item
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Syne' }}>
                        {formatRupiah(t.total)}
                      </p>
                      <Badge color={t.status === 'lunas' ? 'green' : t.status === 'pending' ? 'amber' : 'blue'}>
                        {t.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
