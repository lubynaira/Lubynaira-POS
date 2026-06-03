"use client";

import { useMemo, useState } from "react";
import { Building2, Pencil, Plus, Search, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { generateId } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { uploadPublicImage } from "@/lib/storage";
import { useHppStore } from "@/lib/store";
import type { Customer } from "@/types/product";

export function CustomersPanel({ userId }: { userId?: string }) {
  const customers = useHppStore((state) => state.customers ?? []);
  const addCustomer = useHppStore((state) => state.addCustomer);
  const removeCustomer = useHppStore((state) => state.removeCustomer);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const filteredCustomers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return customers;

    return customers.filter((customer) =>
      [customer.customer_name, customer.phone, customer.whatsapp, customer.address]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [customers, query]);

  async function handleLogo(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setMessage("");
    try {
      const url = await uploadPublicImage(file, "brand-assets");
      setLogoUrl(url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload logo gagal.");
    } finally {
      setUploading(false);
    }
  }

  function resetForm() {
    setEditingId("");
    setCustomerName("");
    setBrandName("");
    setWhatsapp("");
    setAddress("");
    setNotes("");
    setLogoUrl("");
  }

  function startEdit(customer: Customer) {
    setEditingId(customer.id);
    setCustomerName(customer.customer_name);
    setBrandName(customer.brand_name || "");
    setWhatsapp(customer.phone || customer.whatsapp || "");
    setAddress(customer.address || "");
    setNotes(customer.notes || "");
    setLogoUrl(customer.logo_url || "");
    setShowForm(true);
    setMessage("");
  }

  async function handleDelete(customerId: string) {
    if (supabase) {
      const { error } = await supabase.from("customers").delete().eq("id", customerId);
      if (error) {
        setMessage(error.message);
        return;
      }
    }

    removeCustomer(customerId);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!customerName.trim()) {
      setMessage("Nama customer wajib diisi.");
      return;
    }

    const customer: Customer = {
      id: editingId || generateId(),
      created_at: customers.find((item) => item.id === editingId)?.created_at || new Date().toISOString(),
      customer_name: customerName.trim(),
      brand_name: brandName.trim(),
      phone: whatsapp.trim(),
      whatsapp: whatsapp.trim(),
      address: address.trim(),
      notes: notes.trim(),
      logo_url: logoUrl || null
    };

    let savedCustomer = customer;

    if (supabase && userId) {
      const { data, error } = await supabase
        .from("customers")
        .upsert({
          id: customer.id,
          user_id: userId,
          customer_name: customer.customer_name,
          phone: customer.phone,
          whatsapp: customer.phone,
          address: customer.address,
          notes: customer.notes,
          logo_url: customer.logo_url
        })
        .select()
        .single();

      if (error) {
        setMessage(error.message);
        return;
      }

      if (data) {
        savedCustomer = {
          id: data.id,
          created_at: data.created_at,
          customer_name: data.customer_name,
          brand_name: data.brand_name || "",
          phone: data.phone || data.whatsapp || "",
          whatsapp: data.whatsapp || data.phone || "",
          address: data.address || "",
          notes: data.notes || "",
          logo_url: data.logo_url
        };
      }
    }

    addCustomer(savedCustomer);
    resetForm();
    setShowForm(false);
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Customers</h1>
          <p className="mt-1 text-sm text-muted">Kelola data customer pemilik brand</p>
        </div>
        <Button onClick={() => setShowForm((current) => !current)}>
          {showForm ? <X className="h-4 w-4" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
          {showForm ? "Tutup Form" : "Tambah Customer"}
        </Button>
      </header>

      {showForm ? (
        <form className="app-panel grid gap-5 p-5 xl:grid-cols-[320px_1fr]" onSubmit={handleSubmit}>
          <LogoDropzone value={logoUrl} uploading={uploading} onChange={handleLogo} />

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nama Customer" required>
              <Input value={customerName} placeholder="CV Aisyah Collection" onChange={(event) => setCustomerName(event.target.value)} />
            </Field>
            <Field label="Nomor WhatsApp">
              <Input value={whatsapp} placeholder="+62 812-3456-7890" onChange={(event) => setWhatsapp(event.target.value)} />
            </Field>
            <Field label="Alamat">
              <Input value={address} placeholder="Alamat customer" onChange={(event) => setAddress(event.target.value)} />
            </Field>
            <Field label="Catatan">
              <Input value={notes} placeholder="Catatan opsional" onChange={(event) => setNotes(event.target.value)} />
            </Field>
            <div className="flex items-end gap-2">
              <Button type="submit" className="w-full" disabled={uploading}>
                <Plus className="h-4 w-4" aria-hidden />
                {editingId ? "Update Customer" : "Simpan Customer"}
              </Button>
            </div>
            {message ? <p className="border border-line bg-canvas/60 p-3 text-sm text-muted md:col-span-2">{message}</p> : null}
          </div>
        </form>
      ) : null}

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted" aria-hidden />
        <Input className="pl-9" placeholder="Cari nama customer..." value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>

      <section className="app-panel overflow-hidden">
        <div className="grid grid-cols-[120px_1fr_180px_120px] border-b border-line bg-white/3 px-5 py-3 text-[11px] font-bold uppercase text-muted max-md:hidden">
          <span>Logo</span>
          <span>Nama Customer</span>
          <span>Tanggal Dibuat</span>
          <span className="text-center">Aksi</span>
        </div>

        {filteredCustomers.length === 0 ? (
          <div className="soft-grid flex min-h-72 flex-col items-center justify-center p-6 text-center">
            <Building2 className="mb-4 h-10 w-10 text-accent" aria-hidden />
            <h2 className="text-lg font-semibold text-ink">Belum ada customer</h2>
            <p className="mt-2 max-w-md text-sm text-muted">Tambahkan customer, lalu buat brand dari form HPP.</p>
          </div>
        ) : (
          filteredCustomers.map((customer) => (
            <article
              key={customer.id}
              className="grid items-center gap-4 border-b border-line px-5 py-3 last:border-b-0 md:grid-cols-[120px_1fr_180px_120px]"
            >
              <div className="soft-grid flex h-20 w-24 items-center justify-center overflow-hidden border border-line bg-canvas">
                {customer.logo_url ? (
                  <img src={customer.logo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Building2 className="h-6 w-6 text-accent" aria-hidden />
                )}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-ink">{customer.customer_name}</h2>
                <p className="mt-1 truncate text-sm text-muted">{customer.phone || customer.whatsapp || "-"}</p>
              </div>
              <p className="text-sm text-muted">{formatDate(customer.created_at)}</p>
              <div className="flex gap-2 md:justify-center">
                <Button variant="secondary" size="icon" onClick={() => startEdit(customer)} aria-label="Edit customer">
                  <Pencil className="h-4 w-4" aria-hidden />
                </Button>
                <Button variant="secondary" size="icon" onClick={() => handleDelete(customer.id)} aria-label="Hapus customer">
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </article>
          ))
        )}
      </section>

      <p className="px-4 text-xs text-muted">
        Menampilkan {filteredCustomers.length} dari {customers.length} data
      </p>
    </div>
  );
}

function LogoDropzone({
  value,
  uploading,
  onChange
}: {
  value: string;
  uploading: boolean;
  onChange: (file: File | undefined) => void;
}) {
  return (
    <label
      className="soft-grid flex min-h-44 cursor-pointer flex-col items-center justify-center border border-dashed border-line bg-canvas/50 p-5 text-center transition hover:border-accent/60"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onChange(event.dataTransfer.files?.[0]);
      }}
    >
      {value ? (
        <img src={value} alt="" className="mb-3 h-24 w-24 border border-line object-cover" />
      ) : (
        <Upload className="mb-3 h-8 w-8 text-accent" aria-hidden />
      )}
      <span className="text-sm font-semibold text-ink">{uploading ? "Mengupload..." : "Upload atau seret logo ke sini"}</span>
    <input type="file" accept="image/*" className="sr-only" onChange={(event) => onChange(event.target.files?.[0])} />
    </label>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}
