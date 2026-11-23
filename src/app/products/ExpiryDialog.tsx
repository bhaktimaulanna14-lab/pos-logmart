"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, PlusCircle, Trash2 } from "lucide-react";

type Row = { expiryDate: string; qty: number };

// Catat stok bertanggal kadaluarsa sebuah barang (mis. stok lama di toko). Penjualan memakai tanggal terdekat dulu.
export function ExpiryDialog({ product, onClose, onSaved }: {
  product: { id: string; name: string } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [stockQty, setStockQty] = useState(0);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const loading = !!product && loadedFor !== product.id;
  const close = () => { setLoadedFor(null); onClose(); };

  useEffect(() => {
    if (!product) return;
    fetch(`/api/products/${product.id}/batches`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) throw new Error(json.message);
        setStockQty(json.data.stockQty);
        setRows(json.data.batches.map((b: Row) => ({ expiryDate: b.expiryDate, qty: b.qty })));
        setError("");
      })
      .catch((e) => setError(e.message || "Gagal memuat data"))
      .finally(() => setLoadedFor(product.id));
  }, [product]);

  const dated = rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const update = (i: number, patch: Partial<Row>) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = async () => {
    if (!product) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/products/${product.id}/batches`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batches: rows }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      onSaved();
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!product} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Kadaluarsa — {product?.name}</DialogTitle>
          <DialogDescription>
            Catat tanggal kadaluarsa dan jumlahnya. Saat dijual, stok dengan tanggal terdekat dipakai lebih dulu (FIFO).
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Stok <b>{stockQty}</b> · bertanggal <b>{dated}</b> · tanpa tanggal <b>{Math.max(stockQty - dated, 0)}</b>
            </p>
            {rows.length === 0 && <p className="text-sm text-muted-foreground">Belum ada tanggal kadaluarsa.</p>}
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input type="date" aria-label="Tanggal kadaluarsa" value={r.expiryDate} onChange={(e) => update(i, { expiryDate: e.target.value })} className="flex-1" />
                <Input type="number" aria-label="Jumlah" min={1} value={r.qty} onChange={(e) => update(i, { qty: parseInt(e.target.value) || 0 })} className="w-24 text-center" />
                <span className="text-sm text-muted-foreground">pcs</span>
                <Button variant="ghost" size="icon" title="Hapus baris" className="text-red-500" onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setRows((prev) => [...prev, { expiryDate: "", qty: Math.max(stockQty - dated, 1) }])}>
              <PlusCircle className="w-4 h-4 mr-2" /> Tambah tanggal
            </Button>
            {dated > stockQty && <p className="text-sm text-red-600">Jumlah bertanggal melebihi stok barang.</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={close}>Batal</Button>
          <Button onClick={save} disabled={saving || loading || dated > stockQty}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
