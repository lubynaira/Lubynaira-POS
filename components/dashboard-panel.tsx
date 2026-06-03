"use client";

import { ClipboardList, Layers3, Plus, Shirt, UserRound, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRupiah } from "@/lib/calculations";
import { useHppStore } from "@/lib/store";

export function DashboardPanel() {
  const products = useHppStore((state) => state.products);
  const setActiveView = useHppStore((state) => state.setActiveView);
  const totalModels = new Set(products.map((product) => product.product_code || product.product_name).filter(Boolean)).size;
  const totalHpp = products.length;
  const latestHpp = [...products].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-2">
        <DashboardMetric icon={Layers3} label="Total Model Barang" value={`${totalModels} Model`} />
        <DashboardMetric icon={ClipboardList} label="Total Perhitungan HPP" value={`${totalHpp} HPP`} />
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>HPP Terakhir</CardTitle>
              <p className="mt-1 text-sm text-muted">Ringkasan perhitungan terbaru dari produksi</p>
            </div>
            <Shirt className="h-5 w-5 text-accent" aria-hidden />
          </div>
        </CardHeader>
        <CardContent>
          {latestHpp ? (
            <div className="grid gap-5 lg:grid-cols-[160px_1fr_auto] lg:items-center">
              <div className="soft-grid flex aspect-square w-full max-w-40 items-center justify-center overflow-hidden border border-line bg-canvas">
                {latestHpp.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={latestHpp.photo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-sm font-semibold text-muted">Foto Produk</span>
                )}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-xl font-bold text-ink">{latestHpp.product_name}</h2>
                  <span className="border border-line bg-canvas px-2.5 py-1 text-xs font-semibold text-muted">
                    {latestHpp.product_code}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Detail label="Nama Customer" value={latestHpp.customer_name || "Belum diisi"} />
                  <Detail label="Tanggal Produksi" value={latestHpp.production_date} />
                </div>
              </div>

              <div className="border border-line bg-accent/10 p-5 lg:min-w-56">
                <p className="text-xs font-semibold uppercase text-muted">Hasil HPP</p>
                <p className="mt-2 text-2xl font-bold text-accent">{formatRupiah(latestHpp.total_hpp)}</p>
              </div>
            </div>
          ) : (
            <div className="soft-grid flex min-h-56 flex-col items-center justify-center border border-line bg-canvas p-6 text-center">
              <ClipboardList className="mb-4 h-10 w-10 text-accent" aria-hidden />
              <h2 className="text-lg font-semibold text-ink">Belum ada HPP tersimpan</h2>
              <p className="mt-2 max-w-md text-sm text-muted">
                Buat perhitungan HPP pertama untuk menampilkan ringkasan terbaru di dashboard.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-3 md:grid-cols-3">
        <QuickAction
          icon={Plus}
          label="Buat HPP Baru"
          onClick={() => setActiveView("calculator")}
        />
        <QuickAction
          icon={Layers3}
          label="Daftar Model Barang"
          onClick={() => setActiveView("models")}
        />
        <QuickAction
          icon={UsersRound}
          label="Daftar Customer"
          onClick={() => setActiveView("customers")}
        />
      </section>
    </div>
  );
}

function DashboardMetric({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Layers3;
  label: string;
  value: string;
}) {
  return (
    <div className="app-panel soft-grid p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-muted">{label}</p>
          <p className="mt-4 text-4xl font-bold text-ink">{value}</p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-line bg-panel text-accent">
          <Icon className="h-6 w-6" aria-hidden />
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-line bg-canvas p-4">
      <div className="flex items-center gap-2">
        {label === "Nama Customer" ? <UserRound className="h-4 w-4 text-accent" aria-hidden /> : null}
        <p className="text-xs font-semibold uppercase text-muted">{label}</p>
      </div>
      <p className="mt-2 truncate text-base font-bold text-ink">{value}</p>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onClick
}: {
  icon: typeof Plus;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button variant="secondary" className="h-14 justify-start px-4" onClick={onClick}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-line bg-canvas text-accent">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      {label}
    </Button>
  );
}
