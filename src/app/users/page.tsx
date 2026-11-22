"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Edit, UserX, UserCheck, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useSession } from "@/hooks/useSession";

type Role = "manajer" | "kasir";
type User = { id: string; name: string; username: string; role: Role; isActive: boolean };

type FormState = { name: string; username: string; role: Role; password: string; confirm: string };
const EMPTY_FORM: FormState = { name: "", username: "", role: "kasir", password: "", confirm: "" };
const MIN_PASSWORD = 8;

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export default function UsersPage() {
  const { user: me } = useSession();
  const [searchTerm, setSearchTerm] = useState("");
  const [usersData, setUsersData] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Dialog tambah / edit
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Dialog konfirmasi aktif/nonaktif
  const [toggleTarget, setToggleTarget] = useState<User | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [isToggling, setIsToggling] = useState(false);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/users");
      const json = await res.json();
      if (json.success) setUsersData(json.data);
      else setLoadError(json.message || "Gagal memuat pengguna");
    } catch {
      setLoadError("Terjadi kesalahan jaringan");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = usersData.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormMode("create");
  };

  const openEdit = (u: User) => {
    setEditing(u);
    setForm({ name: u.name, username: u.username, role: u.role, password: "", confirm: "" });
    setFormError(null);
    setFormMode("edit");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const wantsPassword = formMode === "create" || form.password !== "";
    if (wantsPassword) {
      if (form.password.length < MIN_PASSWORD) return setFormError(`Password minimal ${MIN_PASSWORD} karakter`);
      if (form.password !== form.confirm) return setFormError("Konfirmasi password tidak sama");
    }

    const payload: Record<string, unknown> = { name: form.name, username: form.username, role: form.role };
    if (wantsPassword) payload.password = form.password;

    setIsSaving(true);
    try {
      const res = await fetch(formMode === "create" ? "/api/users" : `/api/users/${editing!.id}`, {
        method: formMode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) return setFormError(json.message || "Gagal menyimpan");
      setFormMode(null);
      await fetchUsers();
    } catch {
      setFormError("Terjadi kesalahan jaringan");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!toggleTarget) return;
    setIsToggling(true);
    setToggleError(null);
    try {
      const res = await fetch(`/api/users/${toggleTarget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !toggleTarget.isActive }),
      });
      const json = await res.json();
      if (!json.success) return setToggleError(json.message || "Gagal mengubah status");
      setToggleTarget(null);
      await fetchUsers();
    } catch {
      setToggleError("Terjadi kesalahan jaringan");
    } finally {
      setIsToggling(false);
    }
  };

  const roleBadge = (role: Role) => (
    <Badge
      variant="outline"
      className={
        role === "manajer"
          ? "border-brand-green/40 bg-brand-green/10 text-brand-green-dark"
          : "border-brand-orange-light/40 bg-brand-orange-light/10 text-orange-800"
      }
    >
      {role === "manajer" ? "Manajer" : "Kasir"}
    </Badge>
  );

  const statusBadge = (active: boolean) => (
    <Badge variant={active ? "secondary" : "destructive"}>{active ? "Aktif" : "Nonaktif"}</Badge>
  );

  const actions = (u: User, compact = false) => {
    const isSelf = u.id === me?.id;
    return (
      <>
        <Button
          variant={compact ? "outline" : "ghost"}
          size="sm"
          className="h-8 px-2 gap-1 text-slate-600 hover:text-brand-green hover:bg-brand-green/10"
          onClick={() => openEdit(u)}
          title="Edit pengguna / ganti password"
        >
          <Edit className="w-4 h-4" />
          {!compact && <span className="sr-only md:not-sr-only md:text-xs">Edit</span>}
        </Button>
        <Button
          variant={compact ? "outline" : "ghost"}
          size="sm"
          disabled={isSelf}
          className={`h-8 px-2 gap-1 ${u.isActive ? "text-slate-600 hover:text-red-600 hover:bg-red-50" : "text-slate-600 hover:text-brand-green hover:bg-brand-green/10"}`}
          onClick={() => {
            setToggleError(null);
            setToggleTarget(u);
          }}
          title={isSelf ? "Tidak bisa menonaktifkan akun sendiri" : u.isActive ? "Nonaktifkan" : "Aktifkan kembali"}
        >
          {u.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
          {!compact && <span className="sr-only md:not-sr-only md:text-xs">{u.isActive ? "Nonaktifkan" : "Aktifkan"}</span>}
        </Button>
      </>
    );
  };

  return (
    <div className="p-6 md:p-10 space-y-6 max-w-6xl mx-auto bg-slate-50 min-h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Kelola Pengguna</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Tambah staf, ubah nama/username/peran, reset password, dan nonaktifkan akun.
          </p>
        </div>
        <Button className="gap-2 bg-brand-gradient hover:brightness-105" onClick={openCreate}>
          <Plus className="w-4 h-4" /> Tambah Pengguna
        </Button>
      </div>

      <div className="bg-white p-4 rounded-xl border shadow-sm space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Cari nama atau username..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {loadError && <div className="text-sm text-red-600">{loadError}</div>}

        {/* Desktop Table */}
        <div className="hidden md:block rounded-md border overflow-hidden bg-white">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-slate-600 font-medium border-b">
              <tr>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Peran</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Memuat...
                  </td>
                </tr>
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((u) => (
                  <tr key={u.id} className={`border-b last:border-0 hover:bg-slate-50 ${u.isActive ? "" : "opacity-60"}`}>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {u.name}
                      {u.id === me?.id && <span className="ml-2 text-xs text-brand-orange">(Anda)</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">@{u.username}</td>
                    <td className="px-4 py-3">{roleBadge(u.role)}</td>
                    <td className="px-4 py-3">{statusBadge(u.isActive)}</td>
                    <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">{actions(u)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    Tidak ada pengguna ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden flex flex-col gap-3 pb-8">
          {filteredUsers.map((u) => (
            <div key={u.id} className={`bg-white border rounded-lg p-4 shadow-sm flex flex-col gap-3 ${u.isActive ? "" : "opacity-60"}`}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-slate-900 text-lg leading-none">{u.name}</div>
                  <div className="text-sm text-slate-500 mt-1">@{u.username}</div>
                </div>
                {statusBadge(u.isActive)}
              </div>
              <div className="flex justify-between items-end border-t border-slate-100 pt-3 mt-1">
                <div>
                  <div className="text-xs text-slate-400 mb-1">Peran</div>
                  {roleBadge(u.role)}
                </div>
                <div className="flex gap-2">{actions(u, true)}</div>
              </div>
            </div>
          ))}
          {!isLoading && filteredUsers.length === 0 && (
            <div className="text-center py-8 text-slate-500 border rounded-lg bg-slate-50">Tidak ada pengguna ditemukan.</div>
          )}
        </div>
      </div>

      {/* Dialog tambah / edit */}
      <Dialog open={formMode !== null} onOpenChange={(open) => !open && setFormMode(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <form onSubmit={handleSave} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>{formMode === "create" ? "Tambah Pengguna" : "Edit Pengguna"}</DialogTitle>
              <DialogDescription>
                {formMode === "create"
                  ? "Buat akun baru untuk staf toko."
                  : "Ubah data staf. Kosongkan password bila tidak ingin menggantinya."}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-2">
              <Label htmlFor="u_name">Nama lengkap</Label>
              <Input id="u_name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="u_username">Username</Label>
              <Input
                id="u_username"
                required
                autoComplete="off"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, "") })}
              />
              <p className="text-xs text-slate-500">Huruf kecil, angka, titik, atau minus. Tanpa spasi.</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="u_role">Peran</Label>
              <select
                id="u_role"
                className={selectClass}
                value={form.role}
                disabled={editing?.id === me?.id}
                onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
              >
                <option value="kasir">Kasir</option>
                <option value="manajer">Manajer</option>
              </select>
              {editing?.id === me?.id && <p className="text-xs text-slate-500">Peran akun sendiri tidak bisa diubah.</p>}
            </div>

            <div className="grid gap-3 rounded-lg border border-dashed p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <KeyRound className="w-4 h-4 text-brand-orange" />
                {formMode === "create" ? "Password" : "Reset password (opsional)"}
              </div>
              <Input
                type="password"
                autoComplete="new-password"
                placeholder={`Minimal ${MIN_PASSWORD} karakter`}
                required={formMode === "create"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <Input
                type="password"
                autoComplete="new-password"
                placeholder="Ulangi password"
                required={formMode === "create" || form.password !== ""}
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              />
            </div>

            {formError && <div className="text-sm text-red-600">{formError}</div>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormMode(null)}>Batal</Button>
              <Button type="submit" disabled={isSaving} className="bg-brand-green hover:bg-brand-green-dark text-white">
                {isSaving ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog konfirmasi aktif / nonaktif */}
      <Dialog open={toggleTarget !== null} onOpenChange={(open) => !open && setToggleTarget(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{toggleTarget?.isActive ? "Nonaktifkan pengguna?" : "Aktifkan kembali pengguna?"}</DialogTitle>
            <DialogDescription>
              {toggleTarget?.isActive
                ? `${toggleTarget?.name} tidak akan bisa login lagi. Riwayat transaksi dan shift-nya tetap tersimpan.`
                : `${toggleTarget?.name} akan bisa login kembali.`}
            </DialogDescription>
          </DialogHeader>
          {toggleError && <div className="text-sm text-red-600">{toggleError}</div>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setToggleTarget(null)}>Batal</Button>
            <Button
              disabled={isToggling}
              onClick={handleToggleActive}
              className={toggleTarget?.isActive ? "bg-red-600 hover:bg-red-700 text-white" : "bg-brand-green hover:bg-brand-green-dark text-white"}
            >
              {isToggling ? "Memproses..." : toggleTarget?.isActive ? "Nonaktifkan" : "Aktifkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
