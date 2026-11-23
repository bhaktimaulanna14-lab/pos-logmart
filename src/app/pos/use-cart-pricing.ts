"use client";

import { useEffect, useState } from "react";
import type { CartItem, PricingLine } from "./types";

type Pricing = { key: string; discountTotal: number; total: number; lines: Record<string, PricingLine> };

/**
 * Harga keranjang setelah promo. Promo dihitung di server (sama persis dengan saat checkout)
 * setiap kali isi keranjang berubah, dengan jeda 250 ms agar tidak memanggil server tiap klik.
 */
export function useCartPricing(cart: CartItem[]) {
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const cartKey = cart.map((i) => `${i.id}:${i.qty}`).join(",");

  useEffect(() => {
    if (!cartKey) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/checkout/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: cartKey.split(",").map((s) => ({ id: s.split(":")[0], qty: Number(s.split(":")[1]) })) }),
        });
        const json = await res.json();
        if (!cancelled && json.success) {
          const lines: Record<string, PricingLine> = {};
          for (const l of json.data.lines) lines[l.id] = l;
          setPricing({ key: cartKey, discountTotal: json.data.discountTotal, total: json.data.total, lines });
        }
      } catch (e) {
        console.error("checkout preview:", e);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [cartKey]);

  // Hasil lama (untuk isi keranjang sebelumnya) tidak dipakai.
  const fresh = pricing && pricing.key === cartKey ? pricing : null;
  const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  return {
    subtotal,
    discountTotal: fresh?.discountTotal ?? 0,
    total: cart.length === 0 ? 0 : fresh?.total ?? subtotal,
    lines: fresh?.lines ?? {},
    /** true selama harga promo untuk isi keranjang sekarang belum datang dari server. */
    isPricing: cart.length > 0 && !fresh,
  };
}
