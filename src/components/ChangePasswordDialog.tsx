"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const MIN_PASSWORD = 8;

/** Dialog ganti password untuk akun yang sedang login (semua peran). */
export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const reset = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
    setSuccess(false);
  };

  const handleOpenChange = (value: boolean) => {
    if (!value) reset();
    onOpenChange(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next.length < MIN_PASSWORD) return setError(`Password baru minimal ${MIN_PASSWORD} karakter`);
    if (next !== confirm) return setError("Konfirmasi password baru tidak sama");

    setIsSaving(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const json = await res.json();
      if (!json.success) return setError(json.message || "Gagal mengganti password");
      setSuccess(true);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <form onSubmit={handleSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Ganti Password</DialogTitle>
            <DialogDescription>Masukkan password lama, lalu password baru (minimal {MIN_PASSWORD} karakter).</DialogDescription>
          </DialogHeader>

          {success ? (
            <div className="rounded-lg bg-brand-green/10 text-brand-green-dark text-sm p-3">
              Password berhasil diganti. Gunakan password baru saat login berikutnya.
            </div>
          ) : (
            <>
              <div className="grid gap-2">
                <Label htmlFor="cp_current">Password lama</Label>
                <Input id="cp_current" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cp_new">Password baru</Label>
                <Input id="cp_new" type="password" autoComplete="new-password" required value={next} onChange={(e) => setNext(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cp_confirm">Ulangi password baru</Label>
                <Input id="cp_confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              {error && <div className="text-sm text-red-600">{error}</div>}
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              {success ? "Tutup" : "Batal"}
            </Button>
            {!success && (
              <Button type="submit" disabled={isSaving} className="bg-brand-green hover:bg-brand-green-dark text-white">
                {isSaving ? "Menyimpan..." : "Simpan Password"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
