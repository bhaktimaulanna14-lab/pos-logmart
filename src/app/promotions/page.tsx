"use client";

import { useConfirm } from "@/components/confirm-dialog";
import { formatRupiah } from "@/lib/format";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgePercent, Plus, Edit, Trash2, Power, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ProductPicker, type ProductOption } from "@/components/ProductSearch";

type PromoType = "persen" | "nominal" | "grosir" | "beli_gratis";
type Promo = {
  id: string;
  name: string;
  type: PromoType;
  targetType: "produk" | "kategori";
  productId: string | null;
  categoryId: string | null;
  productName: string | null;
  productBarcode: string | null;
  productPrice: number | null;
  productStock: number | null;
  categoryName: string | null;
  value: number;
  minQty: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  usedCount: number;
  discountGiven: number;
};
type Category = { id: string; name: string };

const TYPE_LABEL: Record<PromoType, string> = {
  persen: "Diskon persen",
  nominal: "Potongan nominal",
  grosir: "Harga grosir",
  beli_gratis: "Beli X gratis Y",
};
const TYPE_HELP: Record<PromoType, string> = {
  persen: "Contoh: diskon 10% untuk setiap item.",
  nominal: "Contoh: potong Rp 2.000 per item.",
  grosir: "Contoh: beli minimal 5, harga jadi Rp 3.000 per item.",
  beli_gratis: "Contoh: beli 2 gratis 1 (barang yang sama). Kasir memasukkan 3 item, 1 item gratis.",
};

const todayWib = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const fmtDate = (ymd: string) =>
  new Date(ymd + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

function describe(p: Pick<Promo, "type" | "value" | "minQty">) {
  switch (p.type) {
    case "persen": return `Diskon ${p.value}%`;
    case "nominal": return `Potong ${formatRupiah(p.value)}/item`;
    case "grosir": return `Min. ${p.minQty} → ${formatRupiah(p.value)}/item`;
    case "beli_gratis": return `Beli ${p.minQty} gratis ${p.value}`;
  }
}

function statusOf(p: Promo) {
  const today = todayWib();
  if (!p.isActive) return { label: "Nonaktif", cls: "bg-slate-100 text-slate-600 border-slate-200" };
  if (today < p.startDate) return { label: "Terjadwal", cls: "bg-blue-50 text-blue-700 border-blue-200" };
  if (today > p.endDate) return { label: "Berakhir", cls: "bg-slate-100 text-slate-500 border-slate-200" };
  return { label: "Berjalan", cls: "bg-brand-green/10 text-brand-green-dark border-brand-green/30" };
}

type FormState = {
  name: string;
  type: PromoType;
  targetType: "produk" | "kategori";
  product: ProductOption | null;
  categoryId: string;
  value: string;
  minQty: string;
  startDate: string;
  endDate: string;
};
const emptyForm = (): FormState => ({
  name: "",
  type: "persen",
  targetType: "produk",
  product: null,
  categoryId: "",
  value: "",
  minQty: "2",
  startDate: todayWib(),
  endDate: todayWib(),
});

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export default function PromotionsPage() {
  const [confirm, confirmDialog] = useConfirm();
  const [promos, setPromos] = useState<Promo[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Promo | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [p, c] = await Promise.all([fetch("/api/promotions").then((r) => r.json()), fetch("/api/categories").then((r) => r.json())]);
      if (p.success) setPromos(p.data);
      else setError(p.message || "Gagal memuat promo");
      if (c.success) setCategories(c.data);
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEdit = (p: Promo) => {
    setEditing(p);
    setForm({
      name: p.name,
      type: p.type,
      targetType: p.targetType,
      product: p.productId
        ? { id: p.productId, name: p.productName ?? "", barcode: p.productBarcode ?? "", price: p.productPrice ?? 0, stock: p.productStock ?? 0 }
        : null,
      categoryId: p.categoryId ?? "",
      value: String(p.value),
      minQty: String(p.minQty),
      startDate: p.startDate,
      endDate: p.endDate,
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSaving(true);
    try {
      const res = await fetch(editing ? `/api/promotions/${editing.id}` : "/api/promotions", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          type: form.type,
          targetType: form.targetType,
          productId: form.targetType === "produk" ? form.product?.id : null,
          categoryId: form.targetType === "kategori" ? form.categoryId : null,
          value: Number(form.value),
          minQty: Number(form.minQty),
          startDate: form.startDate,
          endDate: form.endDate,
        }),
      });
      const json = await res.json();
      if (!json.success) return setFormError(json.message || "Gagal menyimpan promo");
      setIsFormOpen(false);
      await load();
    } catch {
      setFormError("Terjadi kesalahan jaringan");
    } finally {
      setIsSaving(false);
    }
  };

  const toggle = async (p: Promo) => {
    const res = await fetch(`/api/promotions/${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    const json = await res.json();
    if (!json.success) alert(json.message || "Gagal mengubah status promo");
    await load();
  };

  const remove = async (p: Promo) => {
    if (!(await confirm({ title: `Hapus promo "${p.name}"?`, confirmLabel: "Hapus", destructive: true }))) return;
    const res = await fetch(`/api/promotions/${p.id}`, { method: "DELETE" });
    const json = await res.json();
    if (!json.success) alert(json.message || "Gagal menghapus promo");
    await load();
  };

  // Contoh hitungan untuk membantu manajer memahami promo yang sedang dibuat.
  const example = useMemo(() => {
    const price = form.targetType === "produk" ? form.product?.price ?? 0 : 10000;
    const v = Number(form.value) || 0;
    const min = Number(form.minQty) || 1;
    if (!price || !v) return null;
    switch (form.type) {
      case "persen": return `1 item ${formatRupiah(price)} → bayar ${formatRupiah(Math.round(price * (100 - Math.min(v, 100)) / 100))}`;
      case "nominal": return `1 item ${formatRupiah(price)} → bayar ${formatRupiah(Math.max(price - v, 0))}`;
      case "grosir": return `${min} item: normal ${formatRupiah(price * min)} → bayar ${formatRupiah(v * min)}`;
      case "beli_gratis": return `${min + v} item: normal ${formatRupiah(price * (min + v))} → bayar ${formatRupiah(price * min)}`;
    }
  }, [form]);

  const valueLabel: Record<PromoType, string> = {
    persen: "Diskon (%)",
    nominal: "Potongan per item (Rp)",
    grosir: "Harga grosir per item (Rp)",
    beli_gratis: "Jumlah gratis (Y)",
  };

  return (
    <div className="p-6 md:p-10 space-y-6 max-w-6xl mx-auto bg-slate-50 min-h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Promo</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Promo berlaku otomatis di kasir selama periodenya. Bila ada beberapa promo untuk satu barang, yang dipakai adalah potongan terbesar.
          </p>
        </div>
        <Button className="gap-2 bg-brand-gradient hover:brightness-105" onClick={openCreate}>
          <Plus className="w-4 h-4" /> Buat Promo
        </Button>
      </div>

      {error && <div className="p-3 rounded-md border border-red-200 bg-red-50 text-sm text-red-700">{error}</div>}

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-slate-500"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Memuat...</div>
        ) : promos.length === 0 ? (
          <div className="p-10 text-center text-slate-500 space-y-3">
            <BadgePercent className="w-10 h-10 mx-auto text-slate-300" />
            <div>Belum ada promo.</div>
            <Button variant="outline" onClick={openCreate}><Plus className="w-4 h-4 mr-1" /> Buat promo pertama</Button>
          </div>
        ) : (
          <div className="divide-y">
            {promos.map((p) => {
              const st = statusOf(p);
              return (
                <div key={p.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{p.name}</span>
                      <Badge variant="outline" className={st.cls}>{st.label}</Badge>
                      <Badge variant="outline" className="border-brand-orange-light/40 bg-brand-orange-light/10 text-orange-800">{TYPE_LABEL[p.type]}</Badge>
                    </div>
                    <div className="text-sm text-slate-600 mt-1">
                      <span className="font-medium text-brand-orange">{describe(p)}</span>
                      {" · "}
                      {p.targetType === "produk" ? `Barang: ${p.productName}` : `Kategori: ${p.categoryName}`}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {fmtDate(p.startDate)} – {fmtDate(p.endDate)} · dipakai {p.usedCount}× · total potongan {formatRupiah(p.discountGiven)}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" className="gap-1 text-slate-600 hover:text-brand-green" onClick={() => openEdit(p)}>
                      <Edit className="w-4 h-4" /> Edit
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-1 text-slate-600" onClick={() => toggle(p)}>
                      <Power className="w-4 h-4" /> {p.isActive ? "Nonaktifkan" : "Aktifkan"}
                    </Button>
                    {p.usedCount === 0 && (
                      <Button variant="ghost" size="sm" className="gap-1 text-red-600 hover:bg-red-50" onClick={() => remove(p)}>
                        <Trash2 className="w-4 h-4" /> Hapus
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <form onSubmit={save} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Promo" : "Buat Promo"}</DialogTitle>
              <DialogDescription>Promo otomatis berlaku di kasir pada tanggal yang ditentukan (WIB).</DialogDescription>
            </DialogHeader>

            <div className="grid gap-2">
              <Label htmlFor="pr_name">Nama promo</Label>
              <Input id="pr_name" required placeholder="Contoh: Promo Akhir Bulan Indomie" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="pr_type">Jenis promo</Label>
              <select id="pr_type" className={selectClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as PromoType })}>
                {(Object.keys(TYPE_LABEL) as PromoType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
              </select>
              <p className="text-xs text-slate-500">{TYPE_HELP[form.type]}</p>
            </div>

            <div className="grid gap-2">
              <Label>Berlaku untuk</Label>
              <div className="flex gap-2">
                {(["produk", "kategori"] as const).map((t) => (
                  <Button key={t} type="button" size="sm" variant={form.targetType === t ? "default" : "outline"} onClick={() => setForm({ ...form, targetType: t })}>
                    {t === "produk" ? "Satu barang" : "Satu kategori"}
                  </Button>
                ))}
              </div>
              {form.targetType === "produk" ? (
                <ProductPicker value={form.product} onChange={(p) => setForm({ ...form, product: p })} />
              ) : (
                <select className={selectClass} value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                  <option value="">Pilih kategori...</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {(form.type === "grosir" || form.type === "beli_gratis") && (
                <div className="grid gap-2">
                  <Label htmlFor="pr_min">{form.type === "grosir" ? "Jumlah minimal" : "Jumlah beli (X)"}</Label>
                  <Input id="pr_min" type="number" min={form.type === "grosir" ? 2 : 1} required value={form.minQty} onChange={(e) => setForm({ ...form, minQty: e.target.value })} />
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="pr_value">{valueLabel[form.type]}</Label>
                <Input id="pr_value" type="number" min={1} max={form.type === "persen" ? 100 : undefined} required value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="pr_start">Mulai</Label>
                <Input id="pr_start" type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pr_end">Selesai (termasuk)</Label>
                <Input id="pr_end" type="date" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>

            {example && (
              <div className="rounded-md bg-brand-green/5 border border-brand-green/20 p-3 text-sm text-brand-green-dark">
                Contoh{form.targetType === "kategori" ? " (barang Rp 10.000)" : ""}: {example}
              </div>
            )}
            {formError && <div className="text-sm text-red-600">{formError}</div>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Batal</Button>
              <Button type="submit" disabled={isSaving} className="bg-brand-green hover:bg-brand-green-dark text-white">
                {isSaving ? "Menyimpan..." : "Simpan Promo"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}
