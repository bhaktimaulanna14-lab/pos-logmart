/* eslint-disable */
// @ts-nocheck
"use client";

import { useState, use, useEffect } from "react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { ArrowLeft, CheckCircle, Info, AlertTriangle, Loader2, Package } from "lucide-react";


export default function ReceiveGoodsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const unwrappedParams = use(params);
  const router = useRouter();
  
  const [po, setPo] = useState<Record<string, any>>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [receivedQty, setReceivedQty] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmWarning, setShowConfirmWarning] = useState(false);
  
  useEffect(() => {
    fetch(`/api/purchase-orders/${unwrappedParams.id}`)
      .then(res => res.json())
      .then(json => {
        if(json.success && json.data) {
          setPo(json.data);
          // Initialize form state
          setReceivedQty(
            Object.fromEntries(json.data.items.map((item: any) => [item.id, item.quantity]))
          );
        }
        setIsLoading(false);
      })
      .catch(err => {
        console.error(err);
        setIsLoading(false);
      });
  }, [unwrappedParams.id]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Memuat data penerimaan...</p>
      </div>
    );
  }

  if (!po) return notFound();
  
  if (po.status !== "dipesan") {
    // Cannot receive if already received or cancelled
    router.replace(`/purchase-orders/${unwrappedParams.id}`);
    return null;
  }

  const handleQtyChange = (itemId: string, value: string) => {
    const parsed = Math.max(0, parseInt(value) || 0);
    setReceivedQty((prev) => ({ ...prev, [itemId]: parsed }));
    // reset warning if user edits
    setShowConfirmWarning(false);
  };

  const totalOrdered = po.items.reduce((sum: number, item: any) => sum + item.quantity, 0);
  const totalReceiving = Object.values(receivedQty).reduce((sum: number, q: number) => sum + q, 0);

  const itemsWithSelisih = po.items.filter(
    (item: any) => (receivedQty[item.id] ?? item.quantity) !== item.quantity
  );
  const itemsZeroed = po.items.filter(
    (item: any) => (receivedQty[item.id] ?? item.quantity) === 0
  );
  const hasSelisih = itemsWithSelisih.length > 0;

  const handleConfirmClick = () => {
    if (hasSelisih) {
      setShowConfirmWarning(true);
    } else {
      executeReceive();
    }
  };

  const handleFinalConfirm = () => {
    executeReceive();
  };
  
  const executeReceive = async () => {
    setIsSubmitting(true);
    try {
      const receivedItemsPayload = po.items.map((item: any) => ({
        productId: item.productId,
        qty: receivedQty[item.id] ?? 0
      }));
      
      const res = await fetch("/api/purchase-orders/receive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poId: po.id,
          receivedItems: receivedItemsPayload
        })
      });
      const json = await res.json();
      if (json.success) {
        setSubmitted(true);
      } else {
        alert(json.message || "Gagal memproses penerimaan");
      }
    } catch (e) {
      console.error(e);
      alert("Terjadi kesalahan jaringan");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    const receiveTime = new Date().toLocaleString("id-ID", {
      day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
    return (
      <div className="p-6 max-w-lg mx-auto text-center space-y-6 mt-8">
        <div className="flex justify-center">
          <CheckCircle className="w-16 h-16 text-green-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Penerimaan Berhasil!</h1>
          <p className="text-muted-foreground mt-2">
            {po.poNumber} dari {po.supplierName} telah dikonfirmasi pada {receiveTime}.
            <br/><br/>
            Stok produk telah diperbarui secara otomatis.
          </p>
        </div>

        <Button asChild className="w-full">
          <Link href="/purchase-orders">Kembali ke Daftar PO</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Back & Header */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 flex items-center gap-1 -ml-2 text-muted-foreground"
          asChild
        >
          <Link href={`/purchase-orders/${unwrappedParams.id}`}>
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Detail PO
          </Link>
        </Button>

        <div>
          <h1 className="text-3xl font-bold tracking-tight">Proses Penerimaan Barang</h1>
          <p className="text-muted-foreground">
            {po.poNumber} · {po.supplierName}
          </p>
        </div>
      </div>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Petunjuk</AlertTitle>
        <AlertDescription>
          Periksa fisik barang yang datang. Ubah jumlah diterima jika ada selisih
          dengan jumlah yang dipesan. Jumlah yang dikosongkan (0) dianggap tidak diterima.
        </AlertDescription>
      </Alert>

      {/* Items Input Table */}
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Barang</TableHead>
              <TableHead>Barcode</TableHead>
              <TableHead className="text-center">Qty Dipesan</TableHead>
              <TableHead className="text-center w-[160px]">Qty Diterima</TableHead>
              <TableHead className="text-center">Selisih</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {po.items?.length === 0 ? (
               <TableRow>
                 <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                   <Package className="w-8 h-8 mx-auto mb-2 opacity-20" />
                   Tidak ada barang
                 </TableCell>
               </TableRow>
            ) : po.items?.map((item: any) => {
              const received = receivedQty[item.id] ?? item.quantity;
              const diff = received - item.quantity;
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="font-mono text-sm">{item.barcode}</TableCell>
                  <TableCell className="text-center">{item.quantity}</TableCell>
                  <TableCell className="text-center">
                    <Input
                      type="number"
                      min={0}
                      // max={item.quantity} -> removed max to allow over-receiving if desired, but user is warned
                      value={received}
                      onChange={(e) => handleQtyChange(item.id, e.target.value)}
                      className="w-24 mx-auto text-center font-bold"
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    {diff === 0 ? (
                      <Badge variant="secondary" className="text-green-700 bg-green-50 border-green-200">Sesuai</Badge>
                    ) : diff < 0 ? (
                      <Badge variant="destructive">{diff}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-brand-green bg-brand-green/10 border-brand-green/30">+{diff}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Selisih Warning */}
      {showConfirmWarning && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Ada Selisih pada {itemsWithSelisih.length} Barang</AlertTitle>
          <AlertDescription className="space-y-2 mt-2">
            <ul className="list-disc pl-4 text-sm space-y-1">
              {itemsWithSelisih.map((item: any) => {
                const received = receivedQty[item.id] ?? item.quantity;
                const diff = received - item.quantity;
                return (
                  <li key={item.id}>
                    <span className="font-medium">{item.name}</span>:{" "}
                    dipesan {item.quantity}, diterima {received}{" "}
                    ({diff > 0 ? `+${diff}` : diff})
                  </li>
                );
              })}
            </ul>
            <p className="text-sm mt-2">Tetap konfirmasi dengan jumlah di atas?</p>
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="outline" onClick={() => setShowConfirmWarning(false)}>
                Koreksi Dulu
              </Button>
              <Button size="sm" variant="destructive" onClick={handleFinalConfirm} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Ya, Konfirmasi Tetap
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Summary & Action */}
      <div className="flex items-center justify-between border-t pt-4">
        <div className="text-sm text-muted-foreground">
          Total diterima: <span className="font-semibold text-foreground">{totalReceiving}</span> / {totalOrdered} item
          {itemsZeroed.length > 0 && (
            <span className="ml-2 text-destructive">· {itemsZeroed.length} barang tidak diterima</span>
          )}
        </div>
        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <Link href={`/purchase-orders/${unwrappedParams.id}`}>Batal</Link>
          </Button>
          <Button onClick={handleConfirmClick} className="flex items-center gap-2" disabled={isSubmitting || showConfirmWarning}>
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Konfirmasi Penerimaan
          </Button>
        </div>
      </div>
    </div>
  );
}
