"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  Calculator,
  ChevronDown,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Moon,
  Palette,
  Settings,
  Shirt,
  Sun,
  UsersRound
} from "lucide-react";
import { AuthScreen } from "@/components/auth-screen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CustomersPanel } from "@/components/customers-panel";
import { ConverterPanel } from "@/components/converter-panel";
import { DashboardPanel } from "@/components/dashboard-panel";
import { HistoryPanel } from "@/components/history-panel";
import { HppForm } from "@/components/hpp-form";
import { SimpleCalculatorPanel } from "@/components/simple-calculator-panel";
import { SettingsPanel } from "@/components/settings-panel";
import { usePwa } from "@/hooks/use-pwa";
import { useThemeMode } from "@/hooks/use-theme";
import { productFromRow } from "@/lib/product-mappers";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useHppStore } from "@/lib/store";
import type { AppView, Brand, Customer } from "@/types/product";

const navItems: Array<{ id: AppView; label: string; icon: typeof Calculator }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "customers", label: "Customers", icon: UsersRound },
  { id: "calculator", label: "HPP", icon: ClipboardList },
  { id: "models", label: "Model Barang", icon: Shirt },
  { id: "conversion", label: "Konversi", icon: Calculator },
  { id: "kalkulator", label: "Kalkulator", icon: Calculator },
  { id: "settings", label: "Pengaturan", icon: Settings }
];

export function AppShell() {
  usePwa();
  const { ready: themeReady, theme, toggleTheme } = useThemeMode();
  const { activeView, setActiveView, setProducts, setCustomers, setBrands, settings, setSettings, role, setRole } = useHppStore();
  const [user, setUser] = useState<User | null>(null);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const hex = "#cb9e36";
    const rgb = hexToRgb(hex);
    if (rgb) {
      document.documentElement.style.setProperty("--accent-rgb", `${rgb.r} ${rgb.g} ${rgb.b}`);
    }
  }, []);

  useEffect(() => {
    if (window.location.pathname === "/kalkulator") {
      setActiveView("kalkulator");
      return;
    }
    const view = new URLSearchParams(window.location.search).get("view");
    if (view === "history" || view === "riwayat" || view === "converter") {
      setActiveView("conversion");
      return;
    }
    if (view && navItems.some((item) => item.id === view)) {
      setActiveView(view as AppView);
    }
  }, [setActiveView]);

  const loadRemoteData = useCallback(async (userId: string) => {
    if (!supabase) return;

    const [{ data: productRows }, { data: customerRows }, brandResult, { data: profile }, { data: brandSettings }] = await Promise.all([
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("customers").select("*").order("created_at", { ascending: false }),
      supabase.from("brands").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
      supabase.from("brand_settings").select("*").eq("user_id", userId).maybeSingle()
    ]);

    setProducts((productRows || []).map(productFromRow));
    const parsedCustomers = (customerRows || []).map(customerFromRow);
    setCustomers(parsedCustomers);
    const parsedBrands = brandResult.error ? [] : (brandResult.data || []).map((row) => brandFromRow(row, parsedCustomers));
    setBrands(mergeLegacyBrands(parsedBrands, parsedCustomers));
    setRole(profile?.role || "owner");

    if (brandSettings) {
      setSettings({
        brand_name: brandSettings.brand_name,
        logo_url: brandSettings.logo_url,
        theme_color: brandSettings.theme_color
      });
    }
  }, [setBrands, setCustomers, setProducts, setRole, setSettings]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    async function loadSession() {
      const { data } = await supabase!.auth.getSession();
      if (!mounted) return;
      setUser(data.session?.user || null);
      if (data.session?.user) {
        await loadRemoteData(data.session.user.id);
      }
      setLoading(false);
    }

    loadSession();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user || null);
      if (session?.user) {
        await loadRemoteData(session.user.id);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadRemoteData]);

  async function handleLogout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
  }

  const activeTitle = useMemo(() => navItems.find((item) => item.id === activeView)?.label || "HPP", [activeView]);

  if (!mounted || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="app-panel flex items-center gap-3 p-5">
          <Calculator className="h-5 w-5 animate-spin text-accent" aria-hidden />
          <span className="text-sm font-medium text-muted">Menyiapkan aplikasi...</span>
        </div>
      </main>
    );
  }

  if (isSupabaseConfigured && !user) {
    return <AuthScreen />;
  }

  return (
    <div className="min-h-screen p-4 text-ink">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1500px] overflow-hidden border border-line bg-black/55 shadow-[0_24px_80px_rgb(0_0_0/0.45)] backdrop-blur">
        <aside className="hidden w-[204px] shrink-0 border-r border-line bg-panel/70 lg:flex lg:flex-col">
          <button className="flex items-center gap-3 px-6 py-6 text-left" onClick={() => setActiveView("dashboard")}>
            <div className="flex h-9 w-9 items-center justify-center border border-accent text-accent">
              <Palette className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-lg font-black leading-none text-accent">SKUPY</p>
              <p className="mt-1 text-[11px] font-bold tracking-[0.12em] text-accent">HPP GAMIS</p>
            </div>
          </button>

          <nav className="space-y-2 px-3" aria-label="Menu aplikasi">
            {navItems.map((item) => {
              const Icon = item.icon;
              const disabled = item.id === "settings" && role === "staff";
              const active = activeView === item.id;

              return (
                <button
                  key={item.id}
                  className={
                    active
                      ? "flex h-11 w-full items-center gap-3 whitespace-nowrap border border-accent/10 bg-accent/15 px-4 text-sm font-semibold text-accent"
                      : "flex h-11 w-full items-center gap-3 whitespace-nowrap border border-transparent px-4 text-sm font-medium text-muted transition hover:border-line hover:bg-white/5 hover:text-ink"
                  }
                  disabled={disabled}
                  title={disabled ? "Hanya owner" : item.label}
                  onClick={() => setActiveView(item.id)}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto border-t border-line p-4">
            <div className="flex items-center gap-3">
              <div className="soft-grid flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-accent/60 bg-canvas text-accent">
                {settings.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={settings.logo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Palette className="h-4 w-4" aria-hidden />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-ink">{settings.brand_name}</p>
                <p className="text-xs text-muted">{role === "owner" ? "Owner" : "Staff"}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-muted" aria-hidden />
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-line bg-panel/45 px-4 py-3 lg:hidden">
            <div>
              <p className="text-sm font-black text-accent">SKUPY</p>
              <p className="text-xs text-muted">{activeTitle}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Ubah tema">
                {!themeReady ? <span className="h-4 w-4" /> : theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              {user ? (
                <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Keluar">
                  <LogOut className="h-4 w-4" aria-hidden />
                </Button>
              ) : null}
            </div>
          </header>

          <nav className="flex gap-2 overflow-x-auto border-b border-line px-4 py-3 lg:hidden" aria-label="Menu aplikasi mobile">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button key={item.id} variant={activeView === item.id ? "primary" : "secondary"} size="sm" onClick={() => setActiveView(item.id)}>
                  <Icon className="h-4 w-4" aria-hidden />
                  {item.label}
                </Button>
              );
            })}
          </nav>

          <main className="min-w-0 flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
            {!isSupabaseConfigured ? <Badge className="mb-4">Demo lokal</Badge> : null}
            {activeView === "dashboard" ? <DashboardPanel /> : null}
            {activeView === "customers" ? <CustomersPanel userId={user?.id} /> : null}
            {activeView === "calculator" ? <HppForm userId={user?.id} /> : null}
            {activeView === "models" ? <HistoryPanel userId={user?.id} /> : null}
            {activeView === "conversion" || activeView === "converter" ? <ConverterPanel /> : null}
            {activeView === "kalkulator" ? <SimpleCalculatorPanel /> : null}
            {activeView === "settings" ? <SettingsPanel userId={user?.id} /> : null}
          </main>
        </div>
      </div>
    </div>
  );
}

function hexToRgb(hex: string) {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return null;

  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16)
  };
}

function customerFromRow(row: {
  id: string;
  created_at: string;
  customer_name: string;
  brand_name?: string;
  whatsapp?: string;
  phone?: string;
  address: string;
  notes: string;
  logo_url: string | null;
}): Customer {
  return {
    id: row.id,
    created_at: row.created_at,
    customer_name: row.customer_name,
    brand_name: row.brand_name || "",
    phone: row.phone || row.whatsapp || "",
    whatsapp: row.whatsapp || row.phone || "",
    address: row.address || "",
    notes: row.notes || "",
    logo_url: row.logo_url
  };
}

function brandFromRow(
  row: {
    id: string;
    created_at: string;
    brand_name: string;
    logo_url: string | null;
    customer_id: string | null;
    owner?: string;
  },
  customers: Customer[]
): Brand {
  const customer = customers.find((item) => item.id === row.customer_id);
  return {
    id: row.id,
    created_at: row.created_at,
    brand_name: row.brand_name,
    logo_url: row.logo_url,
    customer_id: row.customer_id,
    customer_name: customer?.customer_name || row.owner || "",
    owner: row.owner || customer?.customer_name || ""
  };
}

function mergeLegacyBrands(brands: Brand[], customers: Customer[]) {
  const existing = new Set(brands.map((brand) => brand.brand_name.toLowerCase()));
  const legacyBrands: Brand[] = customers
    .filter((customer) => customer.brand_name && !existing.has(customer.brand_name.toLowerCase()))
    .map((customer) => ({
      id: `legacy-${customer.id}`,
      created_at: customer.created_at,
      brand_name: customer.brand_name || customer.customer_name,
      logo_url: customer.logo_url,
      customer_id: customer.id,
      customer_name: customer.customer_name,
      owner: customer.customer_name,
      legacy: true
    }));

  return [...brands, ...legacyBrands];
}
