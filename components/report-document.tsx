"use client";

import * as React from "react";
import { QRCodeSVG } from "qrcode.react";
import { formatNumber, formatRupiah } from "@/lib/calculations";
import { EXPORT_SIZES } from "@/lib/export-sizes";
import type { BrandSettings, ExportSize, Product } from "@/types/product";

interface ReportDocumentProps {
  product: Product;
  settings: BrandSettings;
  size: ExportSize;
  detailUrl: string;
}

const gold = "#cb9e36";
const bg = "#030405";
const panel = "#111316";
const line = "#2c3035";
const ink = "#f4f1eb";
const muted = "#a2a5aa";

export const ReportDocument = React.forwardRef<HTMLDivElement, ReportDocumentProps>(
  ({ product, settings, size, detailUrl }, ref) => {
    const config = EXPORT_SIZES[size];
    const materialTotal = product.fabric_qty * product.fabric_price;
    const materialPrintingTotal = product.fabric_printing_enabled ? product.fabric_qty * product.fabric_printing_price : 0;
    const materialSubtotal = materialTotal + materialPrintingTotal;
    const additionalMaterials = product.additional_materials || [];
    const additionalMaterialTotal = additionalMaterials.reduce((total, material) => total + material.total, 0);
    const additionalPrintingTotal = additionalMaterials.reduce((total, material) => total + material.printing_total, 0);
    const totalMaterialOnly = materialTotal + additionalMaterialTotal;
    const totalPrinting = materialPrintingTotal + additionalPrintingTotal;
    const totalMaterial = totalMaterialOnly + totalPrinting;
    const totalComponentsCost = product.sewing_cost + product.accessory_cost + product.label_cost + product.shipping_cost + product.other_cost;
    const printedAt = new Intl.DateTimeFormat("id-ID", {
      dateStyle: "long",
      timeStyle: "short"
    }).format(new Date());

    return (
      <div
        ref={ref}
        className="report-print-area"
        style={{
          width: config.width,
          minHeight: config.height,
          background: bg,
          color: ink,
          padding: 56,
          fontFamily: "'Avenir Next', 'Segoe UI', Arial, sans-serif",
          position: "relative",
          overflow: "visible"
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 12% 0%, rgba(203,158,54,0.22), transparent 28%), linear-gradient(135deg, #030405 0%, #0d0f11 100%)"
          }}
        />

        <div style={{ position: "relative", zIndex: 1 }}>
          <header style={{ display: "flex", justifyContent: "space-between", gap: 32, borderBottom: `2px solid ${line}`, paddingBottom: 30 }}>
            <div style={{ display: "flex", gap: 22, alignItems: "center" }}>
              <ImageBox src={product.logo_url || settings.logo_url} size={88} fallback={initials(product.brand_name || settings.brand_name)} />
              <div>
                <p style={{ margin: 0, color: gold, fontSize: 24, fontWeight: 900, letterSpacing: 0 }}>LAPORAN HPP</p>
                <h1 style={{ margin: "10px 0 0", fontSize: 48, lineHeight: 1.04 }}>{product.product_name || "Produk"}</h1>
                <p style={{ margin: "12px 0 0", color: muted, fontSize: 22 }}>{product.product_code || "-"} · {product.production_date || "-"}</p>
              </div>
            </div>
            <div style={{ textAlign: "right", minWidth: 250 }}>
              <p style={{ margin: 0, color: muted, fontSize: 20 }}>Brand</p>
              <p style={{ margin: "8px 0 0", color: ink, fontSize: 30, fontWeight: 900 }}>{product.brand_name || settings.brand_name}</p>
              <p style={{ margin: "10px 0 0", color: muted, fontSize: 18 }}>{product.customer_name || "Customer belum diisi"}</p>
            </div>
          </header>

          <section style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 30, marginTop: 34, alignItems: "start" }}>
            <div style={{ display: "grid", gap: 18 }}>
              <ImageBox src={product.photo_url} size={360} fallback="Foto Produk" rectangular />
              <div style={{ display: "grid", gap: 12 }}>
                <Info label="Nama Customer" value={product.customer_name || "-"} />
                <Info label="Nama Brand" value={product.brand_name || settings.brand_name} />
                <Info label="Tanggal Cetak Laporan" value={printedAt} />
              </div>
            </div>

            <div style={{ display: "grid", gap: 18 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                <Summary label="Total Semua Bahan" value={formatRupiah(totalMaterial)} />
                <Summary label="Total Komponen Biaya" value={formatRupiah(totalComponentsCost)} />
                <Summary label="Total HPP" value={formatRupiah(product.total_hpp)} />
              </div>

              <Panel title="Informasi Produk">
                <GridInfo label="Nama Barang" value={product.product_name || "-"} />
                <GridInfo label="Kode Produksi" value={product.product_code || "-"} />
                <GridInfo label="Tanggal Produksi" value={product.production_date || "-"} />
                <GridInfo label="Bahan Utama" value={product.collection_name || "-"} />
              </Panel>

              <Panel title="Detail Bahan Utama">
                <CostRow label="Nama bahan" value={product.collection_name || "-"} />
                <CostRow label="Pemakaian" value={`${formatNumber(product.fabric_qty)} ${product.fabric_unit}`} />
                <CostRow
                  label={`${formatNumber(product.fabric_qty)} ${product.fabric_unit} x ${formatRupiah(product.fabric_price)}`}
                  value={formatRupiah(materialTotal)}
                />
                {materialPrintingTotal > 0 ? (
                  <CostRow
                    label={`Printing ${product.collection_name || "Bahan"} · ${formatNumber(product.fabric_qty)} ${product.fabric_unit} x ${formatRupiah(product.fabric_printing_price)}`}
                    value={formatRupiah(materialPrintingTotal)}
                  />
                ) : null}
                <CostRow label="Total bahan" value={formatRupiah(materialSubtotal)} strong />
              </Panel>
            </div>
          </section>

          <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 28 }}>
            <Panel title="Detail Bahan Tambahan">
              {additionalMaterials.length === 0 ? (
                <CostRow label="Bahan tambahan" value="-" />
              ) : (
                additionalMaterials.map((material) => (
                  <React.Fragment key={material.id}>
                    <CostRow
                      label={`${material.name || "Bahan"} · ${formatNumber(material.qty)} ${material.unit} x ${formatRupiah(material.price)}`}
                      value={formatRupiah(material.total)}
                    />
                    {material.printing_total > 0 ? (
                      <CostRow
                        label={`Printing ${material.name || "Bahan"} · ${formatNumber(material.qty)} ${material.unit} x ${formatRupiah(material.printing_price)}`}
                        value={formatRupiah(material.printing_total)}
                      />
                    ) : null}
                    <CostRow label={`Total bahan ${material.name || "material"}`} value={formatRupiah(material.subtotal)} strong />
                  </React.Fragment>
                ))
              )}
            </Panel>

            <Panel title="Komponen Biaya">
              <CostRow label="Total bahan kain" value={formatRupiah(totalMaterialOnly)} />
              <CostRow label="Total semua printing" value={formatRupiah(totalPrinting)} />
              <CostRow label="Total semua bahan" value={formatRupiah(totalMaterial)} strong />
              <CostRow label="Ongkos jahit" value={formatRupiah(product.sewing_cost)} />
              <CostRow label="Biaya aksesoris" value={formatRupiah(product.accessory_cost)} />
              <CostRow label="Biaya tag label plastik" value={formatRupiah(product.label_cost)} />
              <CostRow label="Biaya pengiriman" value={formatRupiah(product.shipping_cost)} />
              <CostRow label="Biaya lain-lain" value={formatRupiah(product.other_cost)} />
              <CostRow label="Total komponen biaya" value={formatRupiah(totalComponentsCost)} strong />
              <CostRow label="Total HPP" value={formatRupiah(product.total_hpp)} strong />
            </Panel>
          </section>

          <footer style={{ display: "flex", justifyContent: "space-between", gap: 22, alignItems: "end", marginTop: 32, borderTop: `2px solid ${line}`, paddingTop: 24 }}>
            <div>
              <p style={{ margin: 0, color: gold, fontSize: 24, fontWeight: 900 }}>SKUPY HPP GAMIS</p>
              <p style={{ margin: "8px 0 0", color: muted, fontSize: 18 }}>Laporan estimasi biaya produksi untuk customer.</p>
            </div>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, color: muted, fontSize: 16 }}>Detail produk</p>
                <p style={{ margin: "6px 0 0", color: ink, fontSize: 18, fontWeight: 800 }}>{product.product_code || product.id.slice(0, 8)}</p>
              </div>
              <div style={{ background: "#fff", padding: 10 }}>
                <QRCodeSVG value={detailUrl || "https://skupy-hpp-gamis.vercel.app"} size={96} includeMargin />
              </div>
            </div>
          </footer>
        </div>
      </div>
    );
  }
);

ReportDocument.displayName = "ReportDocument";

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: panel, border: `2px solid ${line}`, padding: 22 }}>
      <h2 style={{ margin: "0 0 14px", color: gold, fontSize: 24 }}>{title}</h2>
      <div style={{ display: "grid", gap: 10 }}>{children}</div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#090a0b", border: `2px solid ${gold}`, padding: 18, minHeight: 118 }}>
      <p style={{ margin: 0, color: muted, fontSize: 17 }}>{label}</p>
      <p style={{ margin: "14px 0 0", color: gold, fontSize: 28, lineHeight: 1.08, fontWeight: 900 }}>{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: panel, border: `2px solid ${line}`, padding: 16 }}>
      <p style={{ margin: 0, color: muted, fontSize: 16 }}>{label}</p>
      <p style={{ margin: "8px 0 0", color: ink, fontSize: 21, fontWeight: 800 }}>{value}</p>
    </div>
  );
}

function GridInfo({ label, value }: { label: string; value: string }) {
  return <CostRow label={label} value={value} />;
}

function CostRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 18, borderBottom: `1px solid ${line}`, paddingBottom: 9 }}>
      <span style={{ color: muted, fontSize: 18, lineHeight: 1.3 }}>{label}</span>
      <span style={{ color: strong ? gold : ink, fontSize: 19, fontWeight: strong ? 900 : 800, lineHeight: 1.25, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function ImageBox({
  src,
  size,
  fallback,
  rectangular
}: {
  src?: string | null;
  size: number;
  fallback: string;
  rectangular?: boolean;
}) {
  return (
    <div
      style={{
        width: rectangular ? "100%" : size,
        height: size,
        minWidth: rectangular ? undefined : size,
        background: "#090a0b",
        border: `2px solid ${line}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden"
      }}
    >
      {src ? (
        <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <span style={{ color: muted, fontSize: 22, fontWeight: 800, textAlign: "center", padding: 18 }}>{fallback}</span>
      )}
    </div>
  );
}

function initials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase())
    .join("");
}
