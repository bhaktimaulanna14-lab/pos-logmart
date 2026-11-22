/* eslint-disable */
// @ts-nocheck
"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Search, PackagePlus, ChevronRight, Package, Loader2, Trash2 } from "lucide-react";

export default function PurchaseOrdersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("semua");
  const [pos, setPos] = useState<Record<string, any>[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // States for "Create PO" Dialog
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedQty, setSelectedQty] = useState("");
  const [poItems, setPoItems] = useState<{ productId: string; name: string; qty: number }[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  
  // Real products data
  const [products, setProducts] = useState<Record<string, any>[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPOs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/purchase-orders/pending");
      const json = await res.json();
      if (json.success) {
        setPos(json.data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/products");
      const json = await res.json();
      if (json.success) {
        setProducts(json.data);
      }
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    fetchPOs();
    fetchProducts();
  }, [fetchPOs, fetchProducts]);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const filteredPOs = pos.filter((po) => {
    const matchesSearch =
      po.poNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.supplierName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "semua" || po.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleAddItem = () => {
    if (!selectedProduct || !selectedQty || parseInt(selectedQty) <= 0) return;
    
    const prod = products.find(p => p.id === selectedProduct);
    if (!prod) return;

    const existingIndex = poItems.findIndex(i => i.productId === selectedProduct);
    if (existingIndex >= 0) {
      const newItems = [...poItems];
      newItems[existingIndex].qty += parseInt(selectedQty);
      setPoItems(newItems);
    } else {
      setPoItems([
        ...poItems,
        { productId: prod.id, name: prod.name, qty: parseInt(selectedQty) }
      ]);
    }

    setSelectedProduct("");
    setSelectedQty("");
  };

  const handleRemoveItem = (idx: number) => {
    const newItems = [...poItems];
    newItems.splice(idx, 1);
    setPoItems(newItems);
  };

  const handleSubmitPO = async () => {
    setErrorMessage("");
    if (!supplierName) {
      setErrorMessage("Nama supplier harus diisi.");
      return;
    }
    if (!orderDate) {
      setErrorMessage("Tanggal pengadaan harus diisi.");
      return;
    }
    if (poItems.length === 0) {
      setErrorMessage("Minimal 1 barang harus ditambahkan.");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierName,
          orderDate,
          notes,
          items: poItems,
        })
      });
      const json = await res.json();
      if (json.success) {
        setIsCreateOpen(false);
        setSupplierName("");
        setOrderDate(new Date().toISOString().split('T')[0]);
        setNotes("");
        setPoItems([]);
        alert("PO Berhasil Dibuat!");
        fetchPOs(); // Refetch the list to include the new PO
      } else {
        setErrorMessage(json.message || "Gagal membuat PO.");
      }
    } catch (e) {
      console.error(e);
      setErrorMessage("Terjadi kesalahan jaringan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Penerimaan Supplier</h1>
          <p className="text-muted-foreground">
            Kelola pesanan pembelian (PO) dan penerimaan barang dari supplier.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/purchase-orders/history">Riwayat Penerimaan</Link>
          </Button>
          <Button className="flex items-center gap-2" onClick={() => setIsCreateOpen(true)}>
            <PackagePlus className="w-4 h-4" />
            Buat PO Baru
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Menunggu Diterima</p>
          <p className="text-3xl font-bold text-yellow-500">
            {pos.filter((p) => p.status === "dipesan").length}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari No. PO atau supplier..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="w-[200px]">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Semua Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua Status</SelectItem>
              <SelectItem value="dipesan">Menunggu Diterima</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block border rounded-md bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. PO</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Tanggal Pesan</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filteredPOs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  Belum ada PO yang tertunda.
                </TableCell>
              </TableRow>
            ) : (
              filteredPOs.map((po) => (
                <TableRow key={po.id}>
                  <TableCell className="font-medium">{po.poNumber}</TableCell>
                  <TableCell>{po.supplierName}</TableCell>
                  <TableCell>{formatDate(po.orderDate)}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="text-yellow-700 bg-yellow-50 border-yellow-200">
                      Menunggu
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/purchase-orders/${po.id}`}>
                        Detail <ChevronRight className="w-4 h-4 ml-1" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden flex flex-col gap-3 pb-8">
        {isLoading ? (
          <div className="text-center py-8 text-slate-500 border rounded-lg bg-slate-50">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-muted-foreground" />
            Memuat data...
          </div>
        ) : filteredPOs.length === 0 ? (
          <div className="text-center py-8 text-slate-500 border rounded-lg bg-slate-50">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-20" />
            Belum ada PO yang tertunda.
          </div>
        ) : (
          filteredPOs.map((po) => (
            <div key={po.id} className="bg-white border rounded-lg p-4 shadow-sm flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-slate-900">{po.poNumber}</div>
                  <div className="text-xs text-slate-500">{formatDate(po.orderDate)}</div>
                </div>
                <Badge variant="outline" className="text-yellow-700 bg-yellow-50 border-yellow-200 text-[10px] px-1.5 py-0">
                  Menunggu
                </Badge>
              </div>
              
              <div className="pt-2 border-t border-slate-100">
                <div className="text-xs text-slate-400">Supplier</div>
                <div className="font-medium text-slate-800">{po.supplierName}</div>
              </div>

              <div className="flex justify-end pt-1">
                <Button variant="outline" size="sm" className="h-8 text-brand-green border-brand-green/30 hover:bg-brand-green/10 w-full" asChild>
                  <Link href={`/purchase-orders/${po.id}`}>
                    Lihat Detail
                  </Link>
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* CREATE PO DIALOG (REAL INTEGRATION) */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Buat Purchase Order Baru</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {errorMessage && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-md border border-red-200">
                {errorMessage}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supplier">Nama Supplier</Label>
                <Input
                  id="supplier"
                  placeholder="Contoh: PT Sumber Rejeki"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="orderDate">Tanggal Pengadaan</Label>
                <Input
                  id="orderDate"
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="notes">Catatan Pengadaan</Label>
              <Input
                id="notes"
                placeholder="Catatan opsional..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            
            <div className="space-y-3 pt-2">
              <Label>Daftar Barang Pesanan</Label>
              
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">Pilih Barang</Label>
                  <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih produk..." />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map(prod => (
                        <SelectItem key={prod.id} value={prod.id}>
                          {prod.name} ({prod.barcode})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24 space-y-1">
                  <Label className="text-xs text-muted-foreground">Qty</Label>
                  <Input 
                    type="number" 
                    min="1" 
                    placeholder="0" 
                    value={selectedQty}
                    onChange={(e) => setSelectedQty(e.target.value)}
                  />
                </div>
                <Button variant="secondary" onClick={handleAddItem} disabled={!selectedProduct || !selectedQty}>
                  Tambah
                </Button>
              </div>

              <div className="mt-4 max-h-[200px] overflow-y-auto">
                <div className="hidden md:block border rounded-md">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0">
                      <TableRow>
                        <TableHead>Nama Barang</TableHead>
                        <TableHead className="text-center w-24">Qty</TableHead>
                        <TableHead className="w-12 text-center"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {poItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-4 text-muted-foreground italic">
                            Belum ada barang ditambahkan.
                          </TableCell>
                        </TableRow>
                      ) : (
                        poItems.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell className="text-center">{item.qty}</TableCell>
                            <TableCell className="text-center p-0">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={() => handleRemoveItem(idx)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="md:hidden flex flex-col gap-2">
                  {poItems.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground italic border rounded-md">
                      Belum ada barang ditambahkan.
                    </div>
                  ) : (
                    poItems.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 border rounded-md">
                        <div>
                          <div className="font-bold">{item.name}</div>
                          <div className="text-sm text-slate-500">Qty: {item.qty}</div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 shrink-0"
                          onClick={() => handleRemoveItem(idx)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isSubmitting}>Batal</Button>
            <Button onClick={handleSubmitPO} disabled={poItems.length === 0 || !supplierName || isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Simpan PO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
