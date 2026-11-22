"use client";

import { useEffect, useRef, useState } from "react";
import { Search, ScanLine, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

export type ProductOption = {
  id: string;
  barcode: string;
  name: string;
  price: number;
  stock: number;
};

type Props = {
  onSelect: (product: ProductOption) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Tampilkan stok di daftar hasil (default: ya). */
  showStock?: boolean;
  /** Barang dengan stok 0 tidak bisa dipilih (mis. retur ke supplier). */
  disableOutOfStock?: boolean;
  className?: string;
};

/**
 * Pilih SATU barang (mis. form retur): kolom cari yang berganti menjadi kartu barang terpilih.
 */
export function ProductPicker({
  value,
  onChange,
  disableOutOfStock = false,
}: {
  value: ProductOption | null;
  onChange: (product: ProductOption | null) => void;
  disableOutOfStock?: boolean;
}) {
  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border bg-brand-green/5 px-3 py-2 text-sm">
        <div className="min-w-0">
          <div className="font-medium text-slate-900 truncate">{value.name}</div>
          <div className="text-xs text-slate-500">
            {value.barcode} · stok {value.stock}
          </div>
        </div>
        <button
          type="button"
          className="shrink-0 text-xs font-medium text-brand-green hover:underline"
          onClick={() => onChange(null)}
        >
          Ganti
        </button>
      </div>
    );
  }
  return <ProductSearch onSelect={onChange} disableOutOfStock={disableOutOfStock} />;
}

/**
 * Kolom cari barang dengan ketik NAMA atau scan/ketik BARCODE.
 * - Hasil muncul sambil mengetik (debounce 300 ms) dari /api/products/lookup.
 * - Barcode yang cocok persis + Enter langsung dipilih (cocok untuk scanner).
 * - Navigasi hasil dengan ↑/↓ lalu Enter; Esc menutup daftar.
 */
export function ProductSearch({
  onSelect,
  placeholder = "Ketik nama barang atau scan barcode...",
  autoFocus = false,
  showStock = true,
  disableOutOfStock = false,
  className = "",
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductOption[]>([]);
  const [highlight, setHighlight] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const search = async (q: string): Promise<ProductOption[]> => {
    const id = ++requestId.current;
    setIsSearching(true);
    try {
      const res = await fetch(`/api/products/lookup?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      const data: ProductOption[] = json.success ? json.data : [];
      if (id === requestId.current) {
        setResults(data);
        setHighlight(0);
        setNotFound(data.length === 0);
        setIsOpen(true);
      }
      return data;
    } catch {
      return [];
    } finally {
      if (id === requestId.current) setIsSearching(false);
    }
  };

  const pick = (product: ProductOption) => {
    if (disableOutOfStock && product.stock <= 0) return;
    onSelect(product);
    setQuery("");
    setResults([]);
    setIsOpen(false);
    setNotFound(false);
    inputRef.current?.focus();
  };

  const handleChange = (value: string) => {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    if (!value.trim()) {
      setResults([]);
      setIsOpen(false);
      setNotFound(false);
      return;
    }
    timer.current = setTimeout(() => search(value.trim()), 300);
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && results.length) {
      e.preventDefault();
      setIsOpen(true);
      setHighlight((h) => (h + 1) % results.length);
    } else if (e.key === "ArrowUp" && results.length) {
      e.preventDefault();
      setHighlight((h) => (h - 1 + results.length) % results.length);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    } else if (e.key === "Enter") {
      e.preventDefault(); // jangan submit form induk
      const q = query.trim();
      if (!q) return;
      if (timer.current) clearTimeout(timer.current);
      // Scanner mengetik cepat lalu Enter: cari ulang dan pilih barcode yang cocok persis.
      const list = isOpen && results.length && !isSearching ? results : await search(q);
      const exact = list.find((p) => p.barcode === q);
      if (exact) return pick(exact);
      if (isOpen && list[highlight]) return pick(list[highlight]);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          ref={inputRef}
          value={query}
          autoFocus={autoFocus}
          placeholder={placeholder}
          className="pl-9 pr-9"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length && setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 150)}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
          {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
        </span>
      </div>

      {isOpen && (results.length > 0 || notFound) && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-md border bg-white shadow-lg"
        >
          {notFound && results.length === 0 ? (
            <li className="px-3 py-3 text-sm text-slate-500">Barang tidak ditemukan.</li>
          ) : (
            results.map((p, idx) => {
              const disabled = disableOutOfStock && p.stock <= 0;
              return (
                <li
                  key={p.id}
                  role="option"
                  aria-selected={idx === highlight}
                  aria-disabled={disabled}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(p);
                  }}
                  onMouseEnter={() => setHighlight(idx)}
                  className={`flex items-center justify-between gap-3 px-3 py-2 text-sm cursor-pointer ${
                    idx === highlight ? "bg-brand-green/10" : ""
                  } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 truncate">{p.name}</div>
                    <div className="text-xs text-slate-500">{p.barcode}</div>
                  </div>
                  {showStock && (
                    <span className={`shrink-0 text-xs rounded-full px-2 py-0.5 ${p.stock > 0 ? "bg-slate-100 text-slate-600" : "bg-red-50 text-red-600"}`}>
                      Stok {p.stock}
                    </span>
                  )}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
