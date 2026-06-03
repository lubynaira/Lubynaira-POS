"use client";

import { useMemo, useState } from "react";
import { Calculator, Copy, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { formatNumber, formatRupiah, METER_TO_YARD, parseLocaleNumber, YARD_TO_METER } from "@/lib/calculations";
import { cn } from "@/lib/utils";

type ConversionMode = "meter-yard" | "yard-meter";

export function ConverterPanel() {
  const [mode, setMode] = useState<ConversionMode>("meter-yard");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [message, setMessage] = useState("");
  const isMeterToYard = mode === "meter-yard";

  const result = useMemo(() => {
    const qty = parseLocaleNumber(quantity);
    const unitPrice = parseLocaleNumber(price);

    if (isMeterToYard) {
      return {
        fromUnit: "Meter",
        toUnit: "Yard",
        quantity: qty * METER_TO_YARD,
        price: unitPrice * YARD_TO_METER
      };
    }

    return {
      fromUnit: "Yard",
      toUnit: "Meter",
      quantity: qty * YARD_TO_METER,
      price: unitPrice / YARD_TO_METER
    };
  }, [isMeterToYard, price, quantity]);

  const sourceQuantity = parseLocaleNumber(quantity);
  const sourcePrice = parseLocaleNumber(price);
  const copyText = `${formatNumber(sourceQuantity, 2)} ${result.fromUnit} = ${formatNumber(result.quantity, 2)} ${result.toUnit}\nHarga: ${formatRupiah(sourcePrice)} / ${result.fromUnit} = ${formatRupiah(result.price)} / ${result.toUnit}`;

  function reset() {
    setQuantity("");
    setPrice("");
    setMessage("");
  }

  async function copyResult() {
    setMessage("");
    try {
      await navigator.clipboard.writeText(copyText);
      setMessage("Hasil konversi berhasil disalin.");
    } catch {
      setMessage("Browser tidak mengizinkan salin otomatis.");
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-ink">Konversi</h1>
        <p className="mt-2 text-sm text-muted">Konversi meter, yard, dan harga bahan.</p>
      </header>

      <Card className="mx-auto w-full max-w-3xl overflow-hidden">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Konversi Bahan</CardTitle>
              <p className="mt-1 text-sm text-muted">{isMeterToYard ? "1 Meter = 1.09361 Yard" : "1 Yard = 0.9144 Meter"}</p>
            </div>
            <Calculator className="h-5 w-5 text-accent" aria-hidden />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid rounded border border-line bg-canvas/60 p-1 sm:grid-cols-2" role="tablist" aria-label="Mode konversi">
            <ModeButton active={isMeterToYard} onClick={() => setMode("meter-yard")}>
              Meter → Yard
            </ModeButton>
            <ModeButton active={!isMeterToYard} onClick={() => setMode("yard-meter")}>
              Yard → Meter
            </ModeButton>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={isMeterToYard ? "Jumlah Meter" : "Jumlah Yard"}>
              <Input inputMode="decimal" placeholder="0" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            </Field>
            <Field label={isMeterToYard ? "Harga per Meter" : "Harga per Yard"}>
              <Input inputMode="numeric" placeholder="0" value={price} onChange={(event) => setPrice(event.target.value)} />
            </Field>
          </div>

          <section className="soft-grid border border-accent/45 bg-canvas p-5 transition-all duration-300">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-accent">Hasil Konversi</p>
            <div className="mt-5 grid gap-5 md:grid-cols-[1fr_auto_1fr] md:items-center">
              <ResultValue label={`${result.fromUnit} awal`} value={`${formatNumber(sourceQuantity, 2)} ${result.fromUnit}`} />
              <div className="hidden h-px w-10 bg-accent/60 md:block" />
              <ResultValue label={`Hasil dalam ${result.toUnit}`} value={`${formatNumber(result.quantity, 2)} ${result.toUnit}`} highlight />
            </div>

            <div className="mt-6 border-t border-line pt-5">
              <p className="text-sm font-semibold text-muted">Harga:</p>
              <div className="mt-3 grid gap-5 md:grid-cols-[1fr_auto_1fr] md:items-center">
                <ResultValue label={`Harga / ${result.fromUnit}`} value={`${formatRupiah(sourcePrice)} / ${result.fromUnit}`} />
                <div className="hidden h-px w-10 bg-accent/60 md:block" />
                <ResultValue label={`Harga / ${result.toUnit}`} value={`${formatRupiah(result.price)} / ${result.toUnit}`} highlight />
              </div>
            </div>
          </section>

          {message ? <p className="border border-line bg-canvas p-3 text-sm text-muted">{message}</p> : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Button variant="secondary" type="button" onClick={reset}>
              <RotateCcw className="h-4 w-4" aria-hidden />
              Reset
            </Button>
            <Button type="button" onClick={copyResult}>
              <Copy className="h-4 w-4" aria-hidden />
              Salin Hasil
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={cn(
        "h-11 border text-sm font-bold transition-all duration-300",
        active
          ? "border-accent bg-accent text-white shadow-[0_0_24px_rgb(203_158_54/0.22)]"
          : "border-transparent text-muted hover:border-line hover:bg-white/5 hover:text-ink"
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ResultValue({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="min-h-[92px] border border-line bg-panel/65 p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className={highlight ? "mt-3 text-3xl font-black text-[#FFD700]" : "mt-3 text-2xl font-bold text-ink"}>{value}</p>
    </div>
  );
}
