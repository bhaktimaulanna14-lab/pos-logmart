"use client";

import { useRef, useState } from "react";
import { Loader2, ScanLine, Search, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatRupiah } from "@/lib/format";
import type { Product } from "../types";

/**
 * Kolom kiri Kasir: cari barang dengan nama atau scan barcode.
 * Barcode yang cocok persis langsung masuk keranjang; selain itu tampil daftar hasil untuk dipilih.
 */
export function ProductSearchPanel({
  onPick, warning, onDismissWarning,
}: {
  onPick: (product: Product) => void;
  /** Peringatan dari barang terakhir yang dipilih (mis. ada stok kadaluarsa). */
  warning: string;
  onDismissWarning: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = () => {
    setQuery("");
    setResults([]);
    setNotFound(false);
  };

  const pick = (product: Product) => {
    onPick(product);
    // Barang yang stoknya habis ditolak; biarkan hasil pencarian tetap tampil.
    if (product.stock > 0) reset();
  };

  const search = async (text: string) => {
    const q = text.trim();
    if (!q) return reset();
    setIsSearching(true);
    setNotFound(false);
    try {
      const res = await fetch(`/api/products/lookup?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      const found: Product[] = json.success ? json.data : [];
      const exactBarcode = found.find((p) => p.barcode === q);
      if (exactBarcode) {
        // Hasil scan: kosongkan kolom walau stok habis, agar siap untuk scan berikutnya.
        onPick(exactBarcode);
        return reset();
      }
      setResults(found);
      setNotFound(found.length === 0);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounce.current) clearTimeout(debounce.current);
    if (!value) return reset();
    // Tunggu 300 ms setelah berhenti mengetik; scanner barcode diakhiri Enter (lihat handleSubmit).
    debounce.current = setTimeout(() => search(value), 300);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounce.current) clearTimeout(debounce.current);
    search(query);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 border-b md:border-b-0 md:border-r bg-slate-50/50 overflow-hidden">
      <div className="p-4 border-b bg-white shrink-0">
        <form onSubmit={handleSubmit} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            autoFocus
            aria-label="Cari barang atau scan barcode"
            placeholder="Cari nama barang atau scan barcode..."
            className="pl-10 h-12 text-lg shadow-sm pr-10"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isSearching
              ? <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
              : <ScanLine className="w-5 h-5 text-slate-400" />}
          </div>
        </form>
        {warning && (
          <div role="alert" className="mt-2 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <span className="flex-1">{warning}</span>
            <button type="button" aria-label="Tutup peringatan" className="font-bold" onClick={onDismissWarning}>×</button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {results.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {results.map((product) => (
              <Card
                key={product.id}
                className={`cursor-pointer hover:border-brand-green/60 hover:shadow-md transition-colors active:scale-95 ${product.stock <= 0 ? "opacity-50 cursor-not-allowed" : ""}`}
                onClick={() => pick(product)}
              >
                <CardContent className="p-3 md:p-4 text-center flex flex-col h-full">
                  <div className="text-xs text-slate-400 mb-1">{product.barcode}</div>
                  <div className="font-semibold text-sm md:text-base leading-tight mb-2 flex-1">{product.name}</div>
                  <div className="text-brand-orange font-bold mb-2">{formatRupiah(product.price)}</div>
                  <div className="text-xs font-medium text-slate-500 bg-slate-100 rounded-full py-1">Stok: {product.stock}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : notFound ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
            <X className="w-10 h-10 text-red-300" />
            <p>Barang <strong>&ldquo;{query}&rdquo;</strong> tidak ditemukan.</p>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
            <PackageIcon />
            <p>Ketik nama barang atau scan barcode untuk mulai.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PackageIcon() {
  return (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-50" aria-hidden="true">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.29 7 12 12 20.71 7" />
      <line x1="12" y1="22" x2="12" y2="12" />
    </svg>
  );
}
