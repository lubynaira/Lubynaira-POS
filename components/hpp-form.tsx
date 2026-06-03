"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import type { UseFormRegisterReturn } from "react-hook-form";
import { toBlob } from "html-to-image";
import { Building2, Calculator, Calendar, Check, ChevronsUpDown, ImageIcon, MessageCircle, Plus, RefreshCcw, Save, Search, Trash2, X } from "lucide-react";
import { ReportDocument } from "@/components/report-document";
import { ResultPanel } from "@/components/result-panel";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { calculateHpp, formatRupiah, parseLocaleNumber } from "@/lib/calculations";
import {
  defaultProductValues,
  formValuesFromProduct,
  productFromForm,
  productFromRow,
  productToInsert
} from "@/lib/product-mappers";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { uploadPublicImage } from "@/lib/storage";
import { useHppStore } from "@/lib/store";
import { cn, generateId, slugify } from "@/lib/utils";
import type { Brand, HppCalculation, Product, ProductFormValues } from "@/types/product";

interface HppFormProps {
  userId?: string;
}

type OptionalCostField = "accessory_cost" | "label_cost" | "shipping_cost" | "other_cost";

export function HppForm({ userId }: HppFormProps) {
  const {
    addProduct,
    updateProduct,
    editingProduct,
    clearEditing,
    customers,
    brands,
    addBrand,
    settings,
    setSettings,
    setActiveView,
    clearLocalDrafts
  } = useHppStore();
  const safeCustomers = customers ?? [];
  const safeBrands = brands ?? [];
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [brandLogoUploading, setBrandLogoUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [lastResult, setLastResult] = useState<Product | null>(null);
  const [showBrandForm, setShowBrandForm] = useState(false);
  const [brandCustomerId, setBrandCustomerId] = useState("");
  const [newBrandName, setNewBrandName] = useState("");
  const [newBrandLogo, setNewBrandLogo] = useState("");
  const reportRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors }
  } = useForm<ProductFormValues>({
    defaultValues: {
      ...defaultProductValues,
      brand_name: settings.brand_name,
      logo_url: settings.logo_url || ""
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "additional_materials"
  });

  useEffect(() => {
    if (editingProduct) {
      reset(formValuesFromProduct(editingProduct));
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setValue("brand_name", settings.brand_name);
    if (settings.logo_url) setValue("logo_url", settings.logo_url);
  }, [editingProduct, reset, setValue, settings.brand_name, settings.logo_url]);

  const values = watch();
  const calculation = useMemo(() => calculateHpp(values), [values]);
  const draftProduct = useMemo(() => productFromForm(values, calculation, editingProduct?.id || "draft-hpp"), [calculation, editingProduct?.id, values]);
  const detailUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/products/${draftProduct.id}`;
  }, [draftProduct.id]);
  const selectedUnitLabel = values.fabric_unit === "yard" ? "Yard" : "Meter";
  const additionalMaterials = values.additional_materials || [];

  function clearZeroOptionalCost(field: OptionalCostField) {
    if (parseLocaleNumber(watch(field)) <= 0) {
      setValue(field, "", { shouldDirty: true });
    }
  }

  function handleBrandSelect(brand: Brand) {
    setValue("brand_id", brand.id.startsWith("legacy-") ? "" : brand.id, { shouldDirty: true });
    setValue("customer_id", brand.customer_id || "", { shouldDirty: true });
    setValue("customer_name", brand.customer_name || brand.owner || "", { shouldDirty: true, shouldValidate: true });
    setValue("brand_name", brand.brand_name, { shouldDirty: true, shouldValidate: true });
    setValue("logo_url", brand.logo_url || "", { shouldDirty: true });
  }

  async function handlePhotoUpload(file: File | undefined) {
    if (!file) return;

    setUploading(true);
    setMessage("");

    try {
      const url = await uploadPublicImage(file, "product-photos");
      setValue("photo_url", url, { shouldDirty: true, shouldValidate: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload foto produk gagal.");
    } finally {
      setUploading(false);
    }
  }

  async function handleBrandLogoUpload(file: File | undefined) {
    if (!file) return;
    setBrandLogoUploading(true);
    setMessage("");
    try {
      setNewBrandLogo(await uploadPublicImage(file, "brand-assets"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload logo brand gagal.");
    } finally {
      setBrandLogoUploading(false);
    }
  }

  async function handleCreateBrand(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const customer = safeCustomers.find((item) => item.id === brandCustomerId);
    if (!customer || !newBrandName.trim()) {
      setMessage("Pilih customer dan isi nama brand.");
      return;
    }

    const brand: Brand = {
      id: generateId(),
      created_at: new Date().toISOString(),
      brand_name: newBrandName.trim(),
      logo_url: newBrandLogo || null,
      customer_id: customer.id,
      customer_name: customer.customer_name,
      owner: customer.customer_name
    };

    let savedBrand = brand;
    if (supabase && userId) {
      const { data, error } = await supabase
        .from("brands")
        .insert({
          id: brand.id,
          user_id: userId,
          customer_id: brand.customer_id,
          brand_name: brand.brand_name,
          logo_url: brand.logo_url,
          owner: brand.owner
        })
        .select()
        .single();

      if (error) {
        setMessage(error.message);
        return;
      }

      if (data) {
        savedBrand = {
          id: data.id,
          created_at: data.created_at,
          brand_name: data.brand_name,
          logo_url: data.logo_url,
          customer_id: data.customer_id,
          customer_name: customer.customer_name,
          owner: data.owner || customer.customer_name
        };
      }
    }

    addBrand(savedBrand);
    handleBrandSelect(savedBrand);
    setShowBrandForm(false);
    setBrandCustomerId("");
    setNewBrandName("");
    setNewBrandLogo("");
  }

  async function onSubmit(formValues: ProductFormValues) {
    setSaving(true);
    setMessage("");

    try {
      const currentCalculation = calculateHpp(formValues);
      const product = productFromForm(formValues, currentCalculation, editingProduct?.id);
      let savedProduct = product;

      if (supabase && userId) {
        const { data, error } = await supabase
          .from("products")
          .upsert(productToInsert(product, userId))
          .select()
          .single();

        if (error) throw new Error(error.message);
        if (data) savedProduct = productFromRow(data);
      }

      if (editingProduct) {
        updateProduct(savedProduct);
        clearEditing();
        setMessage("Perhitungan berhasil diperbarui.");
      } else {
        addProduct(savedProduct);
        setMessage("Perhitungan berhasil disimpan.");
      }
      setLastResult(savedProduct);

      if (formValues.brand_name && formValues.brand_name !== settings.brand_name) {
        setSettings({ ...settings, brand_name: formValues.brand_name, logo_url: formValues.logo_url || settings.logo_url });
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menyimpan perhitungan.");
    } finally {
      setSaving(false);
    }
  }

  async function ensureDraftReportBlob() {
    if (!reportRef.current) throw new Error("Area laporan belum siap.");
    const node = reportRef.current;
    const blob = await toBlob(node, {
      cacheBust: true,
      pixelRatio: 2,
      width: node.scrollWidth,
      height: node.scrollHeight,
      backgroundColor: "#030405"
    });
    if (!blob) throw new Error("Gagal membuat PNG laporan.");
    return blob;
  }

  async function handleShareWhatsapp(formValues: ProductFormValues) {
    setSharing(true);
    setMessage("");

    try {
      const currentCalculation = calculateHpp(formValues);
      const product = productFromForm(formValues, currentCalculation, editingProduct?.id || "draft-hpp");
      setLastResult(product);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      const blob = await ensureDraftReportBlob();
      const filename = `${slugify(product.product_code || product.product_name || "laporan-hpp") || "laporan-hpp"}.png`;
      const text = `Halo,\nBerikut laporan HPP:\n\nBrand: ${product.brand_name || "-"}\nNama Barang: ${product.product_name || "-"}\nKode Produksi: ${product.product_code || "-"}\nTotal Semua Bahan: ${formatRupiah(currentCalculation.totalMaterial)}\nTotal Komponen Biaya: ${formatRupiah(currentCalculation.totalComponentsCost)}\nTotal HPP: ${formatRupiah(currentCalculation.totalHpp)}\n\nPNG laporan HPP sudah dibuat, silakan lampirkan gambar yang terdownload.`;

      if ("canShare" in navigator && "share" in navigator) {
        const file = new File([blob], filename, { type: "image/png" });
        const shareData = { files: [file], text, title: "Laporan HPP" };
        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          setMessage("Share WhatsApp berhasil dibuka.");
          return;
        }
      }

      downloadBlob(blob, filename);
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
      setMessage("PNG laporan dibuat. Silakan lampirkan gambar yang terdownload ke WhatsApp.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal share WhatsApp.");
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <header>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-ink">HPP</h1>
              <p className="mt-2 text-sm text-muted">Home &gt; HPP &gt; Buat HPP Baru</p>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={() => setActiveView("conversion")}>
              <Calculator className="h-4 w-4" aria-hidden />
              Buka Konversi
            </Button>
          </div>
        </header>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.9fr)]">
          <div className="space-y-5">
            <section className="app-panel p-5">
              <h2 className="mb-4 text-lg font-bold text-ink">Informasi Produk</h2>
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
                  <Field label="Brand" required>
                    <BrandCombobox brands={safeBrands} value={values.brand_id || values.brand_name} onSelect={handleBrandSelect} />
                  </Field>
                  <div className="flex items-end">
                    <Button type="button" className="w-full" onClick={() => setShowBrandForm(true)}>
                      <Plus className="h-4 w-4" aria-hidden />
                      Brand Baru
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Nama Produk" required>
                    <Input placeholder="Gamis Aisyah Premium" {...register("product_name", { required: "Nama produk wajib diisi" })} />
                    {errors.product_name ? <p className="field-help text-coral">{errors.product_name.message}</p> : null}
                  </Field>
                  <Field label="Kode Produksi / SKU" required>
                    <Input placeholder="GM-25001" {...register("product_code", { required: "Kode produksi wajib diisi" })} />
                    {errors.product_code ? <p className="field-help text-coral">{errors.product_code.message}</p> : null}
                  </Field>
                </div>

                <Field label="Tanggal Produksi" required>
                  <div className="relative">
                    <Input type="date" {...register("production_date", { required: true })} />
                    <Calendar className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-muted" aria-hidden />
                  </div>
                </Field>

                <Field label="Foto Produk" required>
                  <PhotoDropzone value={values.photo_url} uploading={uploading} onChange={handlePhotoUpload} />
                </Field>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Nama Customer">
                    <Input placeholder="Terisi otomatis dari Brand" {...register("customer_name")} />
                  </Field>
                  <Field label="Nama Brand" required>
                    <Input placeholder="Nama Brand" {...register("brand_name", { required: "Nama brand wajib diisi" })} />
                    {errors.brand_name ? <p className="field-help text-coral">{errors.brand_name.message}</p> : null}
                  </Field>
                </div>
              </div>
            </section>

            <section className="app-panel p-5">
              <h2 className="mb-5 text-lg font-bold text-ink">Perhitungan HPP</h2>
              <div className="space-y-5">
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-ink">Bahan Utama</h3>
                  <div className="grid gap-3 rounded border border-line bg-canvas/35 p-3 xl:grid-cols-[minmax(150px,1fr)_92px_94px_132px]">
                    <Field label="Bahan">
                      <Input placeholder="Ceruty Premium" {...register("collection_name")} />
                    </Field>
                    <Field label="Pemakaian">
                      <Input inputMode="decimal" placeholder="0" {...register("fabric_qty", { required: true })} />
                    </Field>
                    <Field label="Satuan">
                      <Select {...register("fabric_unit")}>
                        <option value="yard">Yard</option>
                        <option value="meter">Meter</option>
                      </Select>
                    </Field>
                    <Field label={`Harga / ${selectedUnitLabel}`}>
                      <Input inputMode="numeric" placeholder="0" {...register("fabric_price", { required: true })} />
                    </Field>
                    <div className="grid gap-3 rounded border border-line bg-panel/50 p-3 md:grid-cols-[1fr_220px] xl:col-span-4">
                      <label className="flex min-h-10 items-center gap-3 text-sm font-semibold text-ink">
                        <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent-rgb))]" {...register("fabric_printing_enabled")} />
                        Menggunakan Printing
                      </label>
                      {values.fabric_printing_enabled ? (
                        <Field label={`Harga Printing / ${selectedUnitLabel}`}>
                          <Input inputMode="numeric" placeholder="0" {...register("fabric_printing_price")} />
                        </Field>
                      ) : null}
                    </div>
                    <MaterialTotals
                      className="xl:col-span-4"
                      materialTotal={calculation.fabricCost}
                      printingTotal={calculation.fabricPrintingCost}
                      total={calculation.fabricCost + calculation.fabricPrintingCost}
                    />
                  </div>
                </div>

                <div className="border-t border-line pt-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-ink">Bahan Tambahan</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={() => append({ id: generateId(), name: "", qty: "", unit: "yard", price: "", printing_enabled: false, printing_price: "" })}
                    >
                      <Plus className="h-4 w-4" aria-hidden />
                      Tambah Bahan
                    </Button>
                  </div>

                  {fields.length === 0 ? (
                    <p className="rounded border border-dashed border-line bg-canvas/35 p-4 text-sm text-muted">
                      Belum ada bahan tambahan.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {fields.map((field, index) => {
                        const material = additionalMaterials[index];
                        const unit = material?.unit === "meter" ? "Meter" : "Yard";
                        const total = parseLocaleNumber(material?.qty) * parseLocaleNumber(material?.price);
                        const printingTotal = material?.printing_enabled ? parseLocaleNumber(material?.qty) * parseLocaleNumber(material?.printing_price) : 0;

                        return (
                          <div
                            key={field.id}
                            className="grid gap-3 rounded border border-line bg-canvas/35 p-3 xl:grid-cols-[minmax(150px,1fr)_92px_94px_132px_44px]"
                          >
                            <input type="hidden" {...register(`additional_materials.${index}.id`)} />
                            <Field label="Nama bahan">
                              <Input placeholder="Furing / renda" {...register(`additional_materials.${index}.name`)} />
                            </Field>
                            <Field label="Pemakaian">
                              <Input inputMode="decimal" placeholder="0" {...register(`additional_materials.${index}.qty`)} />
                            </Field>
                            <Field label="Satuan">
                              <Select {...register(`additional_materials.${index}.unit`)}>
                                <option value="yard">Yard</option>
                                <option value="meter">Meter</option>
                              </Select>
                            </Field>
                            <Field label={`Harga / ${unit}`}>
                              <Input inputMode="numeric" placeholder="0" {...register(`additional_materials.${index}.price`)} />
                            </Field>
                            <div className="flex items-end">
                              <Button
                                variant="secondary"
                                size="icon"
                                type="button"
                                className="w-full lg:w-11"
                                onClick={() => remove(index)}
                                aria-label="Hapus bahan"
                              >
                                <Trash2 className="h-4 w-4" aria-hidden />
                              </Button>
                            </div>
                            <div className="grid gap-3 rounded border border-line bg-panel/50 p-3 md:grid-cols-[1fr_220px] xl:col-span-5">
                              <label className="flex min-h-10 items-center gap-3 text-sm font-semibold text-ink">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 accent-[rgb(var(--accent-rgb))]"
                                  {...register(`additional_materials.${index}.printing_enabled`)}
                                />
                                Menggunakan Printing
                              </label>
                              {material?.printing_enabled ? (
                                <Field label={`Harga Printing / ${unit}`}>
                                  <Input inputMode="numeric" placeholder="0" {...register(`additional_materials.${index}.printing_price`)} />
                                </Field>
                              ) : null}
                            </div>
                            <MaterialTotals className="xl:col-span-5" materialTotal={total} printingTotal={printingTotal} total={total + printingTotal} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>

          <aside className="app-panel p-5">
            <h2 className="mb-5 text-lg font-bold text-ink">Komponen Biaya</h2>
            <div className="space-y-4">
              <CostInput label="Ongkos Jahit" placeholder="0" required registration={register("sewing_cost", { required: true })} />
              <CostInput
                label="Biaya Aksesoris"
                placeholder="0"
                registration={register("accessory_cost")}
                onBlur={() => clearZeroOptionalCost("accessory_cost")}
              />
              <CostInput
                label="Biaya Tag Label Plastik"
                placeholder="0"
                registration={register("label_cost")}
                onBlur={() => clearZeroOptionalCost("label_cost")}
              />
              <CostInput
                label="Biaya Pengiriman"
                placeholder="0"
                registration={register("shipping_cost")}
                onBlur={() => clearZeroOptionalCost("shipping_cost")}
              />
              <CostInput
                label="Biaya Lain-Lain"
                placeholder="0"
                registration={register("other_cost")}
                onBlur={() => clearZeroOptionalCost("other_cost")}
              />

              <MaterialSummary calculation={calculation} />

              {message ? <p className="border border-line bg-canvas/60 p-3 text-sm text-muted">{message}</p> : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <Button variant="secondary" type="button" disabled={saving || uploading} onClick={handleSubmit(onSubmit)}>
                  <Save className="h-4 w-4" aria-hidden />
                  Simpan Draft
                </Button>
                <Button
                  type="button"
                  className="border-[#25D366] bg-[#25D366] text-white shadow-[0_0_22px_rgb(37_211_102/0.16)] hover:brightness-110"
                  disabled={saving || uploading || sharing}
                  onClick={handleSubmit(handleShareWhatsapp)}
                >
                  <MessageCircle className="h-4 w-4" aria-hidden />
                  {sharing ? "Membuat PNG..." : "Share WhatsApp"}
                </Button>
                <Button type="submit" className="sm:col-span-2" disabled={saving || uploading || sharing}>
                  <Calculator className="h-4 w-4" aria-hidden />
                  {saving ? "Menghitung..." : "Hitung HPP"}
                </Button>
              </div>

              <Button
                variant="ghost"
                type="button"
                className="w-full"
                onClick={() => {
                  clearLocalDrafts();
                  setLastResult(null);
                  setMessage("Draft lokal lama berhasil dibersihkan.");
                }}
              >
                <RefreshCcw className="h-4 w-4" aria-hidden />
                Bersihkan Draft Lokal
              </Button>
            </div>
          </aside>
        </div>

        {!isSupabaseConfigured ? (
          <p className="text-xs text-muted">Data teks tersimpan lokal. Foto lokal hanya dipakai sebagai preview sementara dan tidak disimpan ke localStorage.</p>
        ) : null}
      </form>

      <div className="pointer-events-none fixed left-[-10000px] top-0 z-[-1]">
        <ReportDocument ref={reportRef} product={draftProduct} settings={settings} size="a4" detailUrl={detailUrl} />
      </div>

      {lastResult ? <ResultPanel product={lastResult} fabricCost={calculation.totalMaterial} /> : null}
      {showBrandForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form className="app-panel w-full max-w-xl space-y-4 p-5" onSubmit={handleCreateBrand}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-ink">Brand Baru</h2>
                <p className="mt-1 text-sm text-muted">Brand tersimpan terpisah dan terhubung ke customer.</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setShowBrandForm(false)} aria-label="Tutup">
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </div>
            <Field label="Nama Customer" required>
              <Select value={brandCustomerId} onChange={(event) => setBrandCustomerId(event.target.value)}>
                <option value="">Pilih customer</option>
                {safeCustomers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.customer_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Nama Brand" required>
              <Input value={newBrandName} onChange={(event) => setNewBrandName(event.target.value)} placeholder="Luby Naira" />
            </Field>
            <LogoDropzone value={newBrandLogo} uploading={brandLogoUploading} onChange={handleBrandLogoUpload} />
            <Button type="submit" disabled={brandLogoUploading} className="w-full">
              <Plus className="h-4 w-4" aria-hidden />
              Simpan Brand
            </Button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function BrandCombobox({ brands, value, onSelect }: { brands: Brand[]; value: string; onSelect: (brand: Brand) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = brands.find((brand) => brand.id === value || brand.brand_name === value);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return brands.slice(0, 80);
    return brands
      .filter((brand) => [brand.brand_name, brand.customer_name, brand.owner].join(" ").toLowerCase().includes(needle))
      .slice(0, 80);
  }, [brands, query]);

  return (
    <div className="relative">
      <button
        type="button"
        className="flex min-h-11 w-full items-center justify-between border border-line bg-canvas px-3 text-left text-sm text-ink"
        onClick={() => setOpen((current) => !current)}
      >
        <span className={selected ? "truncate" : "truncate text-muted"}>{selected?.brand_name || "Pilih Brand"}</span>
        <ChevronsUpDown className="h-4 w-4 text-muted" aria-hidden />
      </button>
      {open ? (
        <div className="absolute z-30 mt-2 w-full overflow-hidden border border-line bg-panel shadow-soft">
          <div className="relative border-b border-line">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted" aria-hidden />
            <Input className="border-0 pl-9" placeholder="Cari brand..." value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <div className="max-h-72 overflow-auto p-1">
            {filtered.length === 0 ? (
              <p className="p-3 text-sm text-muted">Brand tidak ditemukan.</p>
            ) : (
              filtered.map((brand) => (
                <button
                  key={brand.id}
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-ink hover:bg-accent/10"
                  onClick={() => {
                    onSelect(brand);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden border border-line bg-canvas text-accent">
                    {brand.logo_url ? (
                      <img src={brand.logo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Building2 className="h-4 w-4" aria-hidden />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{brand.brand_name}</span>
                    <span className="block truncate text-xs text-muted">{brand.customer_name || "Legacy"}</span>
                  </span>
                  {selected?.id === brand.id ? <Check className="h-4 w-4 text-accent" aria-hidden /> : null}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
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
      className="soft-grid flex min-h-36 cursor-pointer flex-col items-center justify-center border border-dashed border-line bg-canvas/50 p-5 text-center transition hover:border-accent/60"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onChange(event.dataTransfer.files?.[0]);
      }}
    >
      {value ? (
        <img src={value} alt="" className="mb-3 h-20 w-20 border border-line object-cover" />
      ) : (
        <Building2 className="mb-3 h-8 w-8 text-accent" aria-hidden />
      )}
      <span className="text-sm font-semibold text-ink">{uploading ? "Mengupload..." : "Upload atau seret logo brand"}</span>
      <input type="file" accept="image/*" className="sr-only" onChange={(event) => onChange(event.target.files?.[0])} />
    </label>
  );
}

function CostInput({
  label,
  placeholder,
  required,
  registration,
  onBlur
}: {
  label: string;
  placeholder: string;
  required?: boolean;
  registration: UseFormRegisterReturn;
  onBlur?: () => void;
}) {
  return (
    <Field label={label} required={required}>
      <div className="relative">
        <Input
          inputMode="numeric"
          placeholder={placeholder}
          className="pr-10"
          {...registration}
          onBlur={(event) => {
            registration.onBlur(event);
            onBlur?.();
          }}
        />
        <span className="pointer-events-none absolute right-3 top-3 text-sm font-semibold text-ink">Rp</span>
      </div>
    </Field>
  );
}

function MaterialTotals({
  materialTotal,
  printingTotal,
  total,
  className
}: {
  materialTotal: number;
  printingTotal: number;
  total: number;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-3 md:grid-cols-3", className)}>
      <MaterialTotalCard label="Total Bahan Kain" value={formatRupiah(materialTotal)} />
      <MaterialTotalCard label="Total Printing" value={formatRupiah(printingTotal)} />
      <MaterialTotalCard label="Total Bahan" value={formatRupiah(total)} important />
    </div>
  );
}

function MaterialTotalCard({ label, value, important }: { label: string; value: string; important?: boolean }) {
  return (
    <div className="flex min-h-[76px] w-full flex-col justify-between border border-line bg-canvas/70 p-3">
      <span className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">{label}</span>
      <strong className={important ? "mt-2 text-xl font-black text-[#FFD700]" : "mt-2 text-base font-bold text-ink"}>{value}</strong>
    </div>
  );
}

function MaterialSummary({ calculation }: { calculation: HppCalculation }) {
  return (
    <div className="grid gap-3 border border-line bg-canvas/40 p-4 text-sm">
      <div className="flex justify-between gap-3">
        <span className="text-muted">Total Semua Bahan</span>
        <strong className="text-ink">{formatRupiah(calculation.totalMaterial)}</strong>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-muted">Total Komponen Biaya</span>
        <strong className="text-ink">{formatRupiah(calculation.totalComponentsCost)}</strong>
      </div>
      <div className="flex items-end justify-between gap-3 border-t border-line pt-4">
        <span className="text-base font-bold text-ink">Total HPP</span>
        <strong className="text-3xl font-black text-[#FFD700]">{formatRupiah(calculation.totalHpp)}</strong>
      </div>
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function PhotoDropzone({
  value,
  uploading,
  onChange
}: {
  value?: string;
  uploading: boolean;
  onChange: (file: File | undefined) => void;
}) {
  return (
    <label
      className="soft-grid flex min-h-32 cursor-pointer flex-col items-center justify-center border border-dashed border-line bg-canvas/50 p-5 text-center transition hover:border-accent/60"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onChange(event.dataTransfer.files?.[0]);
      }}
    >
      {value ? (
        <img src={value} alt="" className="mb-3 h-24 w-24 border border-line object-cover" />
      ) : (
        <ImageIcon className="mb-3 h-8 w-8 text-muted" aria-hidden />
      )}
      <span className="text-sm font-semibold text-ink">{uploading ? "Upload..." : "Seret dan lepas foto produk di sini"}</span>
      <span className="mt-1 text-xs text-muted">atau klik untuk pilih file</span>
      <input type="file" accept="image/*" className="sr-only" onChange={(event) => onChange(event.target.files?.[0])} />
    </label>
  );
}
