"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calculator, FileImage } from "lucide-react";
import { toPng } from "html-to-image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportDocument } from "@/components/report-document";
import { formatNumber, formatRupiah } from "@/lib/calculations";
import { productFromRow } from "@/lib/product-mappers";
import { supabase } from "@/lib/supabase";
import { useHppStore } from "@/lib/store";
import { slugify } from "@/lib/utils";
import type { Product } from "@/types/product";

export function ProductDetailPage({ productId }: { productId: string }) {
  const { products, settings } = useHppStore();
  const [product, setProduct] = useState<Product | null>(products.find((item) => item.id === productId) || null);
  const [message, setMessage] = useState("");
  const reportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const localProduct = products.find((item) => item.id === productId);
    if (localProduct) {
      setProduct(localProduct);
      return;
    }

    async function loadProduct() {
      if (!supabase) return;
      const { data, error } = await supabase.from("products").select("*").eq("id", productId).maybeSingle();
      if (error) {
        setMessage(error.message);
        return;
      }
      if (data) setProduct(productFromRow(data));
    }

    loadProduct();
  }, [productId, products]);

  async function exportDetail() {
    if (!product || !reportRef.current) return;
    const dataUrl = await toPng(reportRef.current, {
      cacheBust: true,
      pixelRatio: 2,
      width: reportRef.current.scrollWidth,
      height: reportRef.current.scrollHeight,
      backgroundColor: "#030405"
    });
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `${slugify(product.product_code || product.product_name)}-detail.png`;
    link.click();
  }

  if (!product) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4 py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <Calculator className="mx-auto mb-4 h-10 w-10 text-accent" aria-hidden />
            <h1 className="text-xl font-bold text-ink">Detail produk belum tersedia</h1>
            <p className="mt-2 text-sm text-muted">
              {message || "Buka dari perangkat yang menyimpan data, atau login ke akun Supabase yang memiliki produk ini."}
            </p>
            <Link
              href="/"
              className="mt-5 inline-flex h-10 items-center justify-center gap-2 border border-accent bg-accent px-4 text-sm font-semibold text-white"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Kembali
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const detailUrl = typeof window !== "undefined" ? window.location.href : "";
  const mainMaterialTotal = product.fabric_qty * product.fabric_price;
  const mainPrintingTotal = product.fabric_printing_enabled ? product.fabric_qty * product.fabric_printing_price : 0;
  const additionalMaterialTotal = (product.additional_materials || []).reduce((total, material) => total + material.total, 0);
  const additionalPrintingTotal = (product.additional_materials || []).reduce((total, material) => total + material.printing_total, 0);
  const totalMaterial = mainMaterialTotal + mainPrintingTotal + additionalMaterialTotal + additionalPrintingTotal;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="inline-flex h-10 items-center gap-2 border border-line bg-panel px-4 text-sm font-semibold text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Kembali
        </Link>
        <Button onClick={exportDetail}>
          <FileImage className="h-4 w-4" aria-hidden />
          Export PNG
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader>
            <CardTitle>{product.product_name}</CardTitle>
            <p className="mt-1 text-sm text-muted">{product.product_code}</p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <Detail label="Brand" value={product.brand_name} />
              <Detail label="Customer" value={product.customer_name || "-"} />
              <Detail label="Tanggal Produksi" value={product.production_date} />
              <Detail label="Koleksi" value={product.collection_name || "-"} />
              <Detail label="Warna" value={product.product_color || "-"} />
              <Detail label="Pemakaian Bahan" value={`${formatNumber(product.fabric_qty)} ${product.fabric_unit}`} />
              <Detail label="Harga Bahan" value={formatRupiah(product.fabric_price)} />
              <Detail label="Total Semua Bahan" value={formatRupiah(totalMaterial)} />
              <Detail label="Total Printing" value={formatRupiah(mainPrintingTotal + additionalPrintingTotal)} />
              <Detail label="Total HPP" value={formatRupiah(product.total_hpp)} />
              <Detail label="Harga Jual" value={formatRupiah(product.selling_price)} />
              <Detail label="Profit" value={formatRupiah(product.profit)} />
              <Detail label="Margin" value={`${formatNumber(product.margin)}%`} />
            </div>
          </CardContent>
        </Card>

        <section className="app-panel overflow-hidden">
          {product.photo_url ? (
            <img src={product.photo_url} alt="" className="h-full min-h-80 w-full object-cover" />
          ) : (
            <div className="flex min-h-80 items-center justify-center text-sm font-semibold text-muted">Foto Produk</div>
          )}
        </section>
      </div>

      <div className="pointer-events-none fixed left-[-10000px] top-0 z-[-1]">
        <ReportDocument
          ref={(node) => {
            reportRef.current = node;
          }}
          product={product}
          settings={settings}
          size="instagram"
          detailUrl={detailUrl}
        />
      </div>
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-line bg-canvas p-4">
      <p className="text-xs font-medium uppercase text-muted">{label}</p>
      <p className="mt-2 text-base font-bold text-ink">{value}</p>
    </div>
  );
}
