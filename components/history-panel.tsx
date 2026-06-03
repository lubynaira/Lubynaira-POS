"use client";

import { useMemo, useState } from "react";
import { Copy, FileSpreadsheet, Pencil, Search, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatRupiah } from "@/lib/calculations";
import { generateId, slugify } from "@/lib/utils";
import { productFromRow, productToInsert } from "@/lib/product-mappers";
import { supabase } from "@/lib/supabase";
import { useHppStore } from "@/lib/store";
import type { Product } from "@/types/product";

interface HistoryPanelProps {
  userId?: string;
}

export function HistoryPanel({ userId }: HistoryPanelProps) {
  const { products, role, startEdit, removeProduct, addProduct } = useHppStore();
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [message, setMessage] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    return products.filter((product) => {
      const matchesText =
        !normalized ||
        [product.product_name, product.product_code, product.brand_name, product.collection_name || ""]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      const matchesFrom = !fromDate || product.production_date >= fromDate;
      const matchesTo = !toDate || product.production_date <= toDate;
      return matchesText && matchesFrom && matchesTo;
    });
  }, [fromDate, products, query, toDate]);

  async function handleDelete(product: Product) {
    if (role !== "owner") return;
    const confirmed = window.confirm(`Hapus ${product.product_name}?`);
    if (!confirmed) return;

    if (supabase) {
      const { error } = await supabase.from("products").delete().eq("id", product.id);
      if (error) {
        setMessage(error.message);
        return;
      }
    }

    removeProduct(product.id);
    setMessage("Data berhasil dihapus.");
  }

  async function handleDuplicate(product: Product) {
    const clone: Product = {
      ...product,
      id: generateId(),
      created_at: new Date().toISOString(),
      product_code: `${product.product_code}-COPY`,
      product_name: `${product.product_name} Copy`
    };

    if (supabase && userId) {
      const { data, error } = await supabase.from("products").insert(productToInsert(clone, userId)).select().single();
      if (error) {
        setMessage(error.message);
        return;
      }
      addProduct(productFromRow(data));
    } else {
      addProduct(clone);
    }

    setMessage("Data berhasil diduplikasi.");
  }

  function exportHistoryExcel() {
    const rows = filtered.map((product) => ({
      Tanggal: product.production_date,
      "Kode Produk": product.product_code,
      "Nama Produk": product.product_name,
      Brand: product.brand_name,
      Customer: product.customer_name || "",
      HPP: Math.round(product.total_hpp),
      Margin: product.margin,
      "Harga Jual": Math.round(product.selling_price),
      Profit: Math.round(product.profit)
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Model Barang");
    XLSX.writeFile(workbook, `model-barang-${slugify(new Date().toISOString().slice(0, 10))}.xlsx`);
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Daftar Model Barang</CardTitle>
              <p className="mt-1 text-sm text-muted">Search, filter tanggal, edit, hapus, duplikasi, dan export Excel</p>
            </div>
            <Button variant="secondary" onClick={exportHistoryExcel} disabled={filtered.length === 0}>
              <FileSpreadsheet className="h-4 w-4" aria-hidden />
              Export Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted" aria-hidden />
              <Input
                className="pl-9"
                placeholder="Cari produk, SKU, brand, koleksi"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </div>

          {message ? <p className="border border-line bg-canvas p-3 text-sm text-muted">{message}</p> : null}
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="font-semibold text-ink">Belum ada model barang yang cocok.</p>
              <p className="mt-2 text-sm text-muted">Simpan perhitungan atau ubah filter pencarian.</p>
            </CardContent>
          </Card>
        ) : (
          filtered.map((product) => (
            <article key={product.id} className="app-panel grid gap-4 p-4 lg:grid-cols-[72px_1fr_auto] lg:items-center">
              <div className="h-[72px] w-[72px] overflow-hidden border border-line bg-canvas">
                {product.photo_url ? (
                  <img src={product.photo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-muted">
                    Foto
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-base font-bold text-ink">{product.product_name}</h2>
                  <span className="border border-line bg-canvas px-2 py-1 text-xs font-semibold text-muted">
                    {product.product_code}
                  </span>
                </div>
                <div className="mt-2 grid gap-2 text-sm text-muted sm:grid-cols-5">
                  <span className="font-semibold text-ink">{product.brand_name || "Legacy"}</span>
                  <span>{product.customer_name || "Customer belum diisi"}</span>
                  <span>{product.production_date}</span>
                  <span>HPP {formatRupiah(product.total_hpp)}</span>
                  <span>Jual {formatRupiah(product.selling_price)}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 lg:justify-end">
                <Button variant="secondary" size="sm" onClick={() => startEdit(product)}>
                  <Pencil className="h-4 w-4" aria-hidden />
                  Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDuplicate(product)}>
                  <Copy className="h-4 w-4" aria-hidden />
                  Duplikasi
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={role !== "owner"}
                  title={role !== "owner" ? "Hanya owner" : "Hapus"}
                  onClick={() => handleDelete(product)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  Hapus
                </Button>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
