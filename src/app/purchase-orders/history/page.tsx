"use client";

import { formatTanggal } from "@/lib/format";
import React, { useState, useEffect, useCallback, Fragment } from "react";
import Link from "next/link";
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
import { ChevronRight, ChevronDown, PackageCheck, Search, Download, Loader2 } from "lucide-react";

import type { PurchaseOrderDetail, PurchaseOrderItem } from "@/lib/purchase-order";

// Riwayat PO: item tanpa harga modal.
type HistoryPO = Omit<PurchaseOrderDetail, "items"> & {
  items: Pick<PurchaseOrderItem, "id" | "productId" | "name" | "barcode" | "quantity" | "receivedQty">[];
};

export default function PurchaseOrderHistoryPage() {
  const [receivedPOs, setReceivedPOs] = useState<HistoryPO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/purchase-orders/history');
      const json = await res.json();
      if(json.success) {
        setReceivedPOs(json.data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const filteredPOs = receivedPOs.filter(
    (po) =>
      po.poNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.supplierName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExportExcel = () => {
    // The GET endpoint generates excel and returns it as a downloadable file
    window.open('/api/purchase-orders/history/excel', '_blank');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Riwayat Penerimaan</h1>
          <p className="text-muted-foreground">
            Daftar pesanan pembelian yang sudah diterima dari supplier.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/purchase-orders">← Kembali ke Daftar PO</Link>
          </Button>
          <Button variant="secondary" className="flex items-center gap-2" onClick={handleExportExcel}>
            <Download className="w-4 h-4" />
            Ekspor Excel
          </Button>
        </div>
      </div>

      {/* Search Filter */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari no. PO atau supplier..."
          className="pl-8"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block border rounded-md bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead>No. PO</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Tanggal Pesan</TableHead>
              <TableHead>Tanggal Diterima</TableHead>
              <TableHead className="text-center">Jml. Item</TableHead>
              <TableHead className="text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filteredPOs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                    <PackageCheck className="w-10 h-10 text-muted-foreground/50" />
                    <p>{searchTerm ? "Tidak ada hasil yang cocok." : "Belum ada penerimaan yang tercatat."}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredPOs.map((po) => (
                <Fragment key={po.id}>
                  <TableRow
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setExpandedId(expandedId === po.id ? null : po.id)}
                  >
                    <TableCell>
                      {expandedId === po.id ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{po.poNumber}</TableCell>
                    <TableCell>{po.supplierName}</TableCell>
                    <TableCell>{formatTanggal(po.orderDate)}</TableCell>
                    <TableCell>{po.receivedAt ? formatTanggal(po.receivedAt) : "-"}</TableCell>
                    <TableCell className="text-center">
                      {po.items?.length || 0}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="text-green-700 bg-green-50 border-green-200">
                        Selesai
                      </Badge>
                    </TableCell>
                  </TableRow>
                  {expandedId === po.id && (
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={7} className="p-0 border-b">
                        <div className="p-4 pl-14">
                          <h4 className="text-sm font-semibold mb-3">Detail Penerimaan Barang</h4>
                          <div className="border rounded-md bg-white">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Nama Barang</TableHead>
                                  <TableHead>Barcode</TableHead>
                                  <TableHead className="text-center">Dipesan</TableHead>
                                  <TableHead className="text-center">Diterima</TableHead>
                                  <TableHead className="text-center">Status</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {po.items.map((item) => {
                                  const diff = item.receivedQty - item.quantity;
                                  return (
                                    <TableRow key={item.id}>
                                      <TableCell className="font-medium">{item.name}</TableCell>
                                      <TableCell className="text-muted-foreground">{item.barcode}</TableCell>
                                      <TableCell className="text-center">{item.quantity}</TableCell>
                                      <TableCell className="text-center font-bold">{item.receivedQty}</TableCell>
                                      <TableCell className="text-center">
                                        {diff === 0 ? (
                                          <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200 text-[10px]">Lengkap</Badge>
                                        ) : diff < 0 ? (
                                          <Badge variant="outline" className="text-red-600 bg-red-50 border-red-200 text-[10px]">Kurang {Math.abs(diff)}</Badge>
                                        ) : (
                                          <Badge variant="outline" className="text-brand-green bg-brand-green/10 border-brand-green/30 text-[10px]">Lebih {diff}</Badge>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                          {po.notes && (
                            <div className="mt-4 text-sm text-slate-600 border-l-2 border-slate-200 pl-3">
                              <strong>Catatan:</strong> {po.notes}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden flex flex-col gap-3 pb-8">
        {isLoading ? (
          <div className="text-center py-8 text-slate-500 border rounded-lg bg-slate-50">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground mb-2" />
            <p>Memuat data...</p>
          </div>
        ) : filteredPOs.length === 0 ? (
          <div className="py-8 text-center text-slate-500 border rounded-lg bg-slate-50 flex flex-col items-center gap-2">
            <PackageCheck className="w-10 h-10 text-muted-foreground/50" />
            <p>{searchTerm ? "Tidak ada hasil yang cocok." : "Belum ada penerimaan yang tercatat."}</p>
          </div>
        ) : (
          filteredPOs.map((po) => (
            <div key={po.id} className="bg-white border rounded-lg shadow-sm overflow-hidden flex flex-col">
              <div 
                className="p-4 cursor-pointer active:bg-slate-50"
                onClick={() => setExpandedId(expandedId === po.id ? null : po.id)}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-bold text-slate-900">{po.poNumber}</div>
                    <div className="text-xs text-slate-500">{formatTanggal(po.orderDate)}</div>
                  </div>
                  <Badge variant="secondary" className="text-green-700 bg-green-50 border-green-200 text-[10px] px-1.5 py-0">
                    Selesai
                  </Badge>
                </div>
                
                <div className="flex justify-between items-end mt-4">
                  <div>
                    <div className="text-xs text-slate-400">Supplier</div>
                    <div className="font-medium text-slate-800">{po.supplierName}</div>
                  </div>
                  <div className="flex items-center text-brand-green text-sm font-medium">
                    {po.items?.length || 0} Item
                    {expandedId === po.id ? (
                      <ChevronDown className="w-4 h-4 ml-1" />
                    ) : (
                      <ChevronRight className="w-4 h-4 ml-1" />
                    )}
                  </div>
                </div>
              </div>
              
              {expandedId === po.id && (
                <div className="bg-slate-50/50 p-4 border-t border-slate-100 flex flex-col gap-3">
                  <div className="text-xs text-slate-500">
                    <span className="font-medium">Diterima pada:</span> {po.receivedAt ? formatTanggal(po.receivedAt) : "-"}
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Daftar Barang</div>
                    {po.items.map((item) => {
                      const diff = item.receivedQty - item.quantity;
                      return (
                        <div key={item.id} className="bg-white border rounded p-3 flex flex-col gap-2">
                          <div className="flex justify-between items-start">
                            <div className="font-medium text-sm leading-tight text-slate-800">{item.name}</div>
                            <div className="text-xs text-slate-400 shrink-0">{item.barcode}</div>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <div className="text-xs">
                              Pesan: <span className="font-medium text-slate-700">{item.quantity}</span> | 
                              Terima: <span className="font-bold text-brand-green ml-1">{item.receivedQty}</span>
                            </div>
                            <div>
                              {diff === 0 ? (
                                <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200 text-[10px] px-1.5 py-0">Lengkap</Badge>
                              ) : diff < 0 ? (
                                <Badge variant="outline" className="text-red-600 bg-red-50 border-red-200 text-[10px] px-1.5 py-0">Kurang {Math.abs(diff)}</Badge>
                              ) : (
                                <Badge variant="outline" className="text-brand-green bg-brand-green/10 border-brand-green/30 text-[10px] px-1.5 py-0">Lebih {diff}</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {po.notes && (
                    <div className="mt-2 text-xs text-slate-600 border-l-2 border-slate-300 pl-3 italic">
                      {po.notes}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
