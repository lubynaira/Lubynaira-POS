"use client";

import { useState } from "react";
import { Palette, Save, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { useThemeMode } from "@/hooks/use-theme";
import { supabase } from "@/lib/supabase";
import { uploadPublicImage } from "@/lib/storage";
import { useHppStore } from "@/lib/store";

interface SettingsPanelProps {
  userId?: string;
}

export function SettingsPanel({ userId }: SettingsPanelProps) {
  const { settings, setSettings, role } = useHppStore();
  const { theme, toggleTheme } = useThemeMode();
  const [brandName, setBrandName] = useState(settings.brand_name);
  const [logoUrl, setLogoUrl] = useState(settings.logo_url || "");
  const [themeColor, setThemeColor] = useState(settings.theme_color);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const locked = role === "staff";

  async function handleLogo(file: File | undefined) {
    if (!file || locked) return;
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

  async function saveSettings() {
    if (locked) return;
    setSaving(true);
    setMessage("");

    const nextSettings = {
      brand_name: brandName || "Skupy Fashion",
      logo_url: logoUrl || null,
      theme_color: themeColor || "#0f8b6f"
    };

    try {
      if (supabase && userId) {
        const { error } = await supabase.from("brand_settings").upsert({
          user_id: userId,
          ...nextSettings
        });
        if (error) throw new Error(error.message);
      }

      setSettings(nextSettings);
      setMessage("Pengaturan brand berhasil disimpan.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Pengaturan gagal disimpan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[480px_1fr]">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Pengaturan Brand</CardTitle>
              <p className="mt-1 text-sm text-muted">Nama brand, logo, warna tema, dan mode tampilan</p>
            </div>
            <Palette className="h-5 w-5 text-accent" aria-hidden />
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {locked ? <p className="border border-line bg-canvas p-3 text-sm text-muted">Role staff hanya dapat melihat pengaturan.</p> : null}

          <Field label="Nama Brand">
            <Input value={brandName} disabled={locked} onChange={(event) => setBrandName(event.target.value)} />
          </Field>

          <Field label="Logo Brand">
            <div className="flex items-center gap-4">
              <div className="h-24 w-24 overflow-hidden border border-line bg-canvas">
                {logoUrl ? (
                  <img src={logoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-muted">
                    Logo
                  </div>
                )}
              </div>
              <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 border border-line bg-panel px-3 text-sm font-semibold text-ink transition hover:border-accent/50">
                <Upload className="h-4 w-4" aria-hidden />
                {uploading ? "Upload..." : "Pilih Logo"}
                <input
                  type="file"
                  accept="image/*"
                  disabled={locked}
                  className="sr-only"
                  onChange={(event) => handleLogo(event.target.files?.[0])}
                />
              </label>
            </div>
          </Field>

          <Field label="Warna Tema">
            <div className="flex gap-3">
              <Input
                type="color"
                className="h-11 w-20 p-1"
                value={themeColor}
                disabled={locked}
                onChange={(event) => setThemeColor(event.target.value)}
              />
              <Input value={themeColor} disabled={locked} onChange={(event) => setThemeColor(event.target.value)} />
            </div>
          </Field>

          <div className="flex flex-wrap gap-2">
            <Button onClick={saveSettings} disabled={saving || locked}>
              <Save className="h-4 w-4" aria-hidden />
              {saving ? "Menyimpan..." : "Simpan Pengaturan"}
            </Button>
            <Button variant="secondary" onClick={toggleTheme}>
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </Button>
          </div>

          {message ? <p className="border border-line bg-canvas p-3 text-sm text-muted">{message}</p> : null}
        </CardContent>
      </Card>

      <section className="app-panel p-5">
        <h2 className="text-lg font-semibold text-ink">Preview Brand</h2>
        <div className="mt-5 border border-line bg-canvas p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden border border-line bg-panel">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <Palette className="h-6 w-6 text-accent" aria-hidden />
              )}
            </div>
            <div>
              <p className="text-sm text-muted">Brand aktif</p>
              <p className="text-2xl font-bold text-ink">{brandName || "Skupy Fashion"}</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="h-16 border border-line" style={{ background: themeColor }} />
            <div className="h-16 border border-line bg-coral" />
            <div className="h-16 border border-line bg-gold" />
          </div>
        </div>
      </section>
    </div>
  );
}
