"use client";

import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  /** Tombol merah untuk tindakan yang menghapus/membatalkan sesuatu. */
  destructive?: boolean;
};
type ReasonOptions = ConfirmOptions & { reasonLabel: string };

type Pending = (ConfirmOptions & { reasonLabel?: string }) & { resolve: (value: boolean | string | null) => void };

const MIN_REASON = 3; // sama dengan validasi alasan di API pembatalan

/**
 * Pengganti confirm()/prompt() bawaan browser, dengan tampilan aplikasi.
 *
 *   const [confirm, confirmDialog] = useConfirm();
 *   if (!(await confirm({ title: "Hapus promo?" }))) return;          // true / false
 *   const alasan = await confirm({ title: "Batalkan?", reasonLabel: "Alasan" }); // teks / null
 *   ...
 *   return <>{...}{confirmDialog}</>;
 */
export function useConfirm() {
  // pending tetap disimpan saat dialog menutup, agar isinya tidak kosong selama animasi tutup.
  const [pending, setPending] = useState<Pending | null>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const cancelRef = useRef<HTMLButtonElement>(null);
  const reasonRef = useRef<HTMLInputElement>(null);

  function confirm(options: ReasonOptions): Promise<string | null>;
  function confirm(options: ConfirmOptions): Promise<boolean>;
  function confirm(options: ConfirmOptions & { reasonLabel?: string }) {
    setReason("");
    return new Promise<boolean | string | null>((resolve) => {
      setPending({ ...options, resolve });
      setOpen(true);
    });
  }

  const asksReason = pending?.reasonLabel != null;
  const close = (ok: boolean) => {
    if (!open || !pending) return;
    pending.resolve(asksReason ? (ok ? reason.trim() : null) : ok);
    setOpen(false);
  };
  const canConfirm = !asksReason || reason.trim().length >= MIN_REASON;

  const dialog = (
    // Esc, klik di luar dan tombol X dihitung "Batal".
    <Dialog open={open} onOpenChange={(open) => { if (!open) close(false); }}>
      {/* Fokus awal di isian alasan, atau di tombol aman (Batal) untuk konfirmasi biasa. */}
      <DialogContent initialFocus={asksReason ? reasonRef : cancelRef}>
        <form
          className="grid gap-4"
          onSubmit={(e) => { e.preventDefault(); if (canConfirm) close(true); }}
        >
          <DialogHeader>
            <DialogTitle>{pending?.title}</DialogTitle>
            {pending?.description && <DialogDescription>{pending.description}</DialogDescription>}
          </DialogHeader>
          {asksReason && (
            <div className="space-y-2">
              <Label htmlFor="confirm-reason">{pending?.reasonLabel}</Label>
              <Input
                id="confirm-reason"
                ref={reasonRef}
                value={reason}
                maxLength={200}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" ref={cancelRef} onClick={() => close(false)}>
              Batal
            </Button>
            <Button type="submit" variant={pending?.destructive ? "destructive" : "default"} disabled={!canConfirm}>
              {pending?.confirmLabel ?? "Ya, lanjutkan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  return [confirm, dialog] as const;
}
