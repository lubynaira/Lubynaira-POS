"use client";

import { useState } from "react";
import { Calculator, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import type { UserRole } from "@/types/product";

export function AuthScreen() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [role, setRole] = useState<UserRole>("owner");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;

    setLoading(true);
    setMessage("");

    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: fullName,
                brand_name: brandName || "Skupy Fashion",
                role
              }
            }
          });

    setLoading(false);

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    setMessage(mode === "login" ? "Login berhasil." : "Akun dibuat. Cek email jika konfirmasi aktif.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-5xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center bg-accent text-white">
            <Calculator className="h-6 w-6" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold text-accent">Skupy HPP Gamis</p>
            <h1 className="text-2xl font-bold text-ink">Masuk ke ruang produksi</h1>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
          <section className="app-panel p-5 sm:p-8">
            <div className="grid gap-5 sm:grid-cols-3">
              <div className="border border-line bg-panel p-4">
                <ShieldCheck className="mb-4 h-6 w-6 text-accent" aria-hidden />
                <h2 className="font-semibold text-ink">Owner</h2>
                <p className="mt-2 text-sm text-muted">Akses penuh untuk input, edit, hapus, export, dan pengaturan brand.</p>
              </div>
              <div className="border border-line bg-panel p-4">
                <LockKeyhole className="mb-4 h-6 w-6 text-coral" aria-hidden />
                <h2 className="font-semibold text-ink">Staff</h2>
                <p className="mt-2 text-sm text-muted">Fokus input produksi dan melihat data tanpa akses hapus atau pengaturan.</p>
              </div>
              <div className="border border-line bg-panel p-4">
                <Calculator className="mb-4 h-6 w-6 text-gold" aria-hidden />
                <h2 className="font-semibold text-ink">Realtime</h2>
                <p className="mt-2 text-sm text-muted">HPP, harga jual, profit, laporan, dan histori tersimpan otomatis.</p>
              </div>
            </div>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>{mode === "login" ? "Login" : "Daftar Akun"}</CardTitle>
              <div className="mt-3 grid grid-cols-2 border border-line bg-canvas p-1">
                <Button
                  variant={mode === "login" ? "primary" : "ghost"}
                  size="sm"
                  onClick={() => setMode("login")}
                >
                  Login
                </Button>
                <Button
                  variant={mode === "register" ? "primary" : "ghost"}
                  size="sm"
                  onClick={() => setMode("register")}
                >
                  Daftar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit}>
                {mode === "register" ? (
                  <>
                    <Field label="Nama Lengkap">
                      <Input value={fullName} onChange={(event) => setFullName(event.target.value)} />
                    </Field>
                    <Field label="Nama Brand">
                      <Input value={brandName} onChange={(event) => setBrandName(event.target.value)} />
                    </Field>
                    <Field label="Role">
                      <Select value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
                        <option value="owner">Owner</option>
                        <option value="staff">Staff</option>
                      </Select>
                    </Field>
                  </>
                ) : null}

                <Field label="Email" required>
                  <Input
                    type="email"
                    value={email}
                    autoComplete="email"
                    required
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </Field>
                <Field label="Password" required>
                  <Input
                    type="password"
                    value={password}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    required
                    minLength={6}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </Field>

                {message ? <p className="border border-line bg-canvas p-3 text-sm text-muted">{message}</p> : null}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Memproses..." : mode === "login" ? "Masuk" : "Buat Akun"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
