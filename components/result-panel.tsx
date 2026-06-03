"use client";

import { useMemo, useRef, useState } from "react";
import { toBlob, toPng } from "html-to-image";
import { Download, FileImage, FileSpreadsheet, MessageCircle, Printer, QrCode } from "lucide-react";
import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { ReportDocument } from "@/components/report-document";
import { formatNumber, formatRupiah } from "@/lib/calculations";
import { EXPORT_SIZES } from "@/lib/export-sizes";
import { slugify } from "@/lib/utils";
import { useHppStore } from "@/lib/store";
import type { ExportSize, Product } from "@/types/product";

interface ResultPanelProps {
  product: Product;
  fabricCost: number;
}

export function ResultPanel({ product, fabricCost }: ResultPanelProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const settings = useHppStore((state) => state.settings);
  const [size, setSize] = useState<ExportSize>("a4");
  const [working, setWorking] = useState<string>("");
  const [message, setMessage] = useState("");
  const additionalMaterials = product.additional_materials || [];

  const detailUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/products/${product.id}`;
  }, [product.id]);

  const filename = `${slugify(product.product_code || product.product_name || "laporan-hpp") || "laporan-hpp"}`;
  const whatsappText = `Nama Brand: ${product.brand_name || settings.brand_name || "-"}\nNama Barang: ${product.product_name || "-"}\nKode Produksi: ${product.product_code || "-"}\nTotal HPP: ${formatRupiah(product.total_hpp)}\nHarga Jual: ${formatRupiah(product.selling_price)}`;

  async function ensureReportPng() {
    if (!reportRef.current) throw new Error("Area laporan belum siap.");
    const node = reportRef.current;
    return toPng(reportRef.current, {
      cacheBust: true,
      pixelRatio: 2,
      width: node.scrollWidth,
      height: node.scrollHeight,
      backgroundColor: "#030405",
      style: {
        transform: "scale(1)",
        transformOrigin: "top left"
      }
    });
  }

  async function ensureReportBlob() {
    if (!reportRef.current) throw new Error("Area laporan belum siap.");
    const node = reportRef.current;
    const blob = await toBlob(node, {
      cacheBust: true,
      pixelRatio: 2,
      width: node.scrollWidth,
      height: node.scrollHeight,
      backgroundColor: "#030405"
    });
    if (!blob) throw new Error("Gagal membuat file PNG.");
    return blob;
  }

  async function handlePng() {
    setWorking("png");
    setMessage("");
    try {
      const dataUrl = await ensureReportPng();
      downloadDataUrl(dataUrl, `${filename}-${size}.png`);
      setMessage("PNG berhasil dibuat.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal export PNG.");
    } finally {
      setWorking("");
    }
  }

  async function handlePdf() {
    setWorking("pdf");
    setMessage("");
    try {
      const dataUrl = await ensureReportPng();
      const image = await loadImage(dataUrl);
      const pdf = new jsPDF({
        orientation: image.width > image.height ? "landscape" : "portrait",
        unit: "px",
        format: [image.width, image.height],
        hotfixes: ["px_scaling"]
      });
      pdf.addImage(dataUrl, "PNG", 0, 0, image.width, image.height);
      pdf.save(`${filename}-${size}.pdf`);
      setMessage("PDF berhasil dibuat.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal export PDF.");
    } finally {
      setWorking("");
    }
  }

  function handleExcel() {
    setWorking("excel");
    setMessage("");
    try {
      const rows = [
        {
          Tanggal: product.production_date,
          Customer: product.customer_name || "",
          Brand: product.brand_name,
          "Kode Produk": product.product_code,
          "Nama Produk": product.product_name,
          "Bahan Utama": product.collection_name || "",
          "Biaya Bahan": Math.round(fabricCost),
          HPP: Math.round(product.total_hpp),
          Margin: product.margin,
          "Harga Jual": Math.round(product.selling_price),
          Profit: Math.round(product.profit)
        }
      ];
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "HPP Produk");
      XLSX.writeFile(workbook, `${filename}.xlsx`);
      setMessage("Excel berhasil dibuat.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal export Excel.");
    } finally {
      setWorking("");
    }
  }

  async function handleWhatsapp() {
    setWorking("whatsapp");
    setMessage("");
    try {
      const blob = await ensureReportBlob();
      const text = `Berikut laporan HPP produk.\n\n${whatsappText}\n\nPNG sudah dibuat, silakan lampirkan gambar yang terdownload ke WhatsApp.`;

      if ("canShare" in navigator) {
        const file = new File([blob], `${filename}-${size}.png`, { type: "image/png" });
        const shareData = { files: [file], text, title: "Laporan HPP" };
        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          setMessage("Share sheet dibuka.");
          return;
        }
      }

      downloadBlob(blob, `${filename}-${size}.png`);
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
      setMessage("PNG sudah dibuat. Silakan lampirkan gambar yang terdownload ke WhatsApp.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal membuka WhatsApp.");
    } finally {
      setWorking("");
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Hasil HPP</CardTitle>
              <p className="mt-1 text-sm text-muted">Laporan siap export PNG dan kirim ke WhatsApp</p>
            </div>
            <QrCode className="h-5 w-5 text-accent" aria-hidden />
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Summary label="Total Semua Bahan" value={formatRupiah(fabricCost)} />
            <Summary label="Total HPP" value={formatRupiah(product.total_hpp)} tone="accent" />
            <Summary label="Harga Jual" value={formatRupiah(product.selling_price)} tone="coral" />
            <Summary label="Profit" value={formatRupiah(product.profit)} tone="gold" />
          </div>

          <div className="soft-grid border border-line bg-canvas p-4">
            <div className="flex items-start gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden border border-line bg-panel">
                {product.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.photo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-muted">
                    Foto
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{product.product_name || "Nama Produk belum diisi"}</p>
                <p className="mt-1 text-xs text-muted">{product.product_code || "Kode produksi belum diisi"}</p>
                <p className="mt-2 text-xs text-muted">
                  {product.customer_name || "Customer belum diisi"} · Margin {formatNumber(product.margin)}%
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <Detail label="Brand" value={product.brand_name || settings.brand_name} />
            <Detail label="Customer" value={product.customer_name || "-"} />
            <Detail label="Tanggal Produksi" value={product.production_date || "-"} />
            <Detail label="Bahan Utama" value={product.collection_name || "-"} />
            <Detail label="Bahan Tambahan" value={`${additionalMaterials.length} item`} />
          </div>

          <div className="space-y-2">
            <label className="field-label" htmlFor="export-size">
              Ukuran Export
            </label>
            <Select id="export-size" value={size} onChange={(event) => setSize(event.target.value as ExportSize)}>
              {Object.values(EXPORT_SIZES).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button onClick={handlePng} disabled={Boolean(working)}>
              <FileImage className="h-4 w-4" aria-hidden />
              {working === "png" ? "Membuat..." : "Export PNG"}
            </Button>
            <Button variant="secondary" onClick={handlePdf} disabled={Boolean(working)}>
              <Printer className="h-4 w-4" aria-hidden />
              {working === "pdf" ? "Membuat..." : "Export PDF"}
            </Button>
            <Button variant="secondary" onClick={handleExcel} disabled={Boolean(working)}>
              <FileSpreadsheet className="h-4 w-4" aria-hidden />
              Export Excel
            </Button>
            <Button variant="outline" onClick={handleWhatsapp} disabled={Boolean(working)}>
              <MessageCircle className="h-4 w-4" aria-hidden />
              Kirim ke WhatsApp
            </Button>
          </div>

          {message ? <p className="border border-line bg-canvas p-3 text-sm text-muted">{message}</p> : null}
          <p className="text-xs text-muted">PNG sudah dibuat saat tombol WhatsApp ditekan. Jika share file tidak didukung browser, lampirkan file PNG yang terdownload secara manual.</p>

          <Button variant="ghost" className="w-full" onClick={handlePng} disabled={Boolean(working)}>
            <Download className="h-4 w-4" aria-hidden />
            Simpan laporan profesional
          </Button>
        </CardContent>
      </Card>

      <div className="pointer-events-none fixed left-[-10000px] top-0 z-[-1]">
        <ReportDocument ref={reportRef} product={product} settings={settings} size={size} detailUrl={detailUrl} />
      </div>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-line bg-panel p-3">
      <p className="text-xs font-medium uppercase text-muted">{label}</p>
      <p className="mt-1 break-words font-semibold text-ink">{value}</p>
    </div>
  );
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function Summary({ label, value, tone }: { label: string; value: string; tone?: "accent" | "coral" | "gold" }) {
  return (
    <div className="border border-line bg-panel p-4">
      <p className="text-xs font-medium uppercase text-muted">{label}</p>
      <p
        className={
          tone === "accent"
            ? "mt-2 break-words text-xl font-bold text-accent"
            : tone === "coral"
              ? "mt-2 break-words text-xl font-bold text-coral"
              : tone === "gold"
                ? "mt-2 break-words text-xl font-bold text-gold"
                : "mt-2 break-words text-xl font-bold text-ink"
        }
      >
        {value}
      </p>
    </div>
  );
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
