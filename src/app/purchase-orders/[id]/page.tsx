/* eslint-disable */
// @ts-nocheck
"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
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
import { ArrowLeft, CheckCircle, XCircle, Package, Loader2, FileDown } from "lucide-react";


export default function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const unwrappedParams = use(params);
  const [po, setPo] = useState<Record<string, any>>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/purchase-orders/${unwrappedParams.id}`)
      .then(res => res.json())
      .then(json => {
        if(json.success) setPo(json.data);
        setIsLoading(false);
      });
  }, [unwrappedParams.id]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Memuat detail PO...</p>
      </div>
    );
  }

  if (!po) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4 text-center">
        <XCircle className="w-12 h-12 text-destructive" />
        <div>
          <h2 className="text-2xl font-bold">PO Tidak Ditemukan</h2>
          <p className="text-muted-foreground mt-2">Dokumen PO ini mungkin sudah dihapus atau tidak pernah ada.</p>
        </div>
        <Button asChild className="mt-4">
          <Link href="/purchase-orders">Kembali ke Daftar PO</Link>
        </Button>
      </div>
    );
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const totalItems = po.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const totalReceived = po.items?.reduce((sum, item) => sum + item.receivedQty, 0) || 0;

  const statusVariant = {
    dipesan: "outline",
    diterima: "secondary",
    dibatalkan: "destructive"
  };

  const statusClassName = {
    dipesan: "text-yellow-700 bg-yellow-50 border-yellow-200",
    diterima: "text-green-700 bg-green-50 border-green-200",
    dibatalkan: ""
  };

  const statusLabel = {
    dipesan: "Menunggu",
    diterima: "Diterima",
    dibatalkan: "Dibatalkan"
  };

  return (
    <div className="p-6 space-y-6">
      {/* Back & Header */}
      <div>
        <Button variant="ghost" size="sm" className="mb-4 flex items-center gap-1 -ml-2 text-muted-foreground" asChild>
          <Link href="/purchase-orders">
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Daftar PO
          </Link>
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-bold tracking-tight">{po.poNumber}</h1>
              <Badge
                variant={statusVariant[po.status] || "default"}
                className={statusClassName[po.status] || ""}
              >
                {statusLabel[po.status] || po.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {po.supplierName} · Dipesan {formatDate(po.orderDate)}
              {po.receivedAt && ` · Diterima ${formatDate(po.receivedAt)}`}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="flex items-center gap-2" asChild>
              <a href={`/api/purchase-orders/${po.id}/pdf`}>
                <FileDown className="w-4 h-4" />
                Unduh PDF
              </a>
            </Button>
          {po.status === "dipesan" && (
            <>
              <Button 
                variant="destructive" 
                className="flex items-center gap-2" 
                onClick={async () => {
                  if(confirm('Yakin ingin membatalkan PO ini?')) {
                    const res = await fetch(`/api/purchase-orders/${po.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'cancel' })
                    });
                    if (res.ok) {
                      setPo({ ...po, status: 'dibatalkan' });
                    } else {
                      alert('Gagal membatalkan PO');
                    }
                  }
                }}
              >
                <XCircle className="w-4 h-4" />
                Batalkan PO
              </Button>
              <Button className="flex items-center gap-2" asChild>
                <Link href={`/purchase-orders/${unwrappedParams.id}/receive`}>
                  <CheckCircle className="w-4 h-4" />
                  Proses Penerimaan
                </Link>
              </Button>
            </>
          )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {po.status !== "dibatalkan" && (
        <div className="border rounded-lg p-4 space-y-2 bg-slate-50">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress Penerimaan</span>
            <span className="font-medium">
              {totalReceived} dari {totalItems} item
            </span>
          </div>
          <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
            <div
              className="bg-green-500 h-full transition-all"
              style={{ width: `${Math.min(100, totalItems > 0 ? (totalReceived / totalItems) * 100 : 0)}%` }}
            />
          </div>
        </div>
      )}

      {/* Items List */}
      <div>
        <h3 className="font-semibold text-lg mb-4">Daftar Barang</h3>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Barang</TableHead>
                <TableHead>Barcode</TableHead>
                <TableHead className="text-center">Qty Dipesan</TableHead>
                <TableHead className="text-center">Qty Diterima</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {po.items?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    Tidak ada barang dalam PO ini
                  </TableCell>
                </TableRow>
              ) : (
                po.items?.map((item) => {
                  const isFullyReceived = item.receivedQty >= item.quantity;
                  const isPartiallyReceived = item.receivedQty > 0 && item.receivedQty < item.quantity;
                  
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="font-mono text-sm">{item.barcode}</TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-center">
                        {item.receivedQty}
                      </TableCell>
                      <TableCell className="text-center">
                        {po.status === "dipesan" ? (
                          <Badge variant="outline" className="text-yellow-700 bg-yellow-50 border-yellow-200">
                            Menunggu
                          </Badge>
                        ) : isFullyReceived ? (
                          <Badge variant="outline" className="text-green-700 bg-green-50 border-green-200">
                            Sesuai
                          </Badge>
                        ) : isPartiallyReceived ? (
                          <Badge variant="outline" className="text-brand-green bg-brand-green/10 border-brand-green/30">
                            Sebagian
                          </Badge>
                        ) : (
                          <Badge variant="destructive">Tidak Diterima</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
