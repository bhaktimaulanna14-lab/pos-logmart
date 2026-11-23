"use client";

import { useConfirm } from "@/components/confirm-dialog";
import React, { useState, useEffect } from "react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, PlusCircle, RotateCcw, Eye, X } from "lucide-react";
import { ProductPicker, ProductSearch, type ProductOption } from "@/components/ProductSearch";

type ReturnItem = {
  id: number;
  returnNumber: string;
  transactionId?: string;
  productId: number;
  productName: string;
  quantity: number;
  reason: string;
  status: "pending" | "disetujui" | "ditolak";
  createdAt: string;
  processedAt?: string;
  processedBy?: number;
  processedByName?: string;
  supplierName?: string | null;
  isPurchaseReturn?: boolean;
};

type Product = {
  id: number;
  name: string;
  barcode: string;
  price: number;
};

export default function ReturnsPage() {
  const [confirm, confirmDialog] = useConfirm();
  const [returns, setReturns] = useState<ReturnItem[]>([]);
  // Barang terpilih di form retur (dicari lewat nama / barcode, bukan dropdown semua barang).
  const [customerProduct, setCustomerProduct] = useState<ProductOption | null>(null);
  const [supplierItems, setSupplierItems] = useState<{ product: ProductOption; qty: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("semua");

      // Form Pengajuan Retur Pelanggan
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({
    transactionId: "",
    productId: "",
    qty: 1,
    reason: "",
  });
  
  // Form Pengajuan Retur Supplier
  const [isSupplierFormOpen, setIsSupplierFormOpen] = useState(false);
  const [supplierFormData, setSupplierFormData] = useState({
    supplierName: "",
    reason: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Detail Modal state
  const [selectedReturn, setSelectedReturn] = useState<ReturnItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  
  const userRole = "manajer";

  const fetchReturns = async () => {
    try {
      const [resSales, resPurchase] = await Promise.all([
        fetch(`/api/returns?q=${searchQuery}&status=${statusFilter}`),
        fetch(`/api/returns/purchase?q=${searchQuery}&status=${statusFilter}`)
      ]);
      const jsonSales = await resSales.json();
      const jsonPurchase = await resPurchase.json();
      
      let all: ReturnItem[] = [];
      if (jsonSales.success) all = [...all, ...jsonSales.data];
      // Mark purchase returns so UI can identify them easily
      if (jsonPurchase.success) {
        const purchaseData = jsonPurchase.data.map((item: ReturnItem) => ({ ...item, isPurchaseReturn: true }));
        all = [...all, ...purchaseData];
      }
      
      // Sort by createdAt descending
      all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setReturns(all);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReturns();
  }, [searchQuery, statusFilter]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSupplierInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSupplierFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.transactionId || !formData.productId || Number(formData.qty) <= 0) {
      alert("Mohon isi form dengan lengkap");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: formData.transactionId,
          productId: formData.productId,
          quantity: Number(formData.qty),
          reason: formData.reason
        })
      });

      const json = await res.json();
      if (json.success) {
        setIsFormOpen(false);
        setFormData({ transactionId: "", productId: "", qty: 1, reason: "" });
        setCustomerProduct(null);
        fetchReturns();
      } else {
        alert(json.message || "Gagal mengajukan retur");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleSubmitSupplierReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!supplierFormData.supplierName || supplierItems.length === 0 || supplierItems.some((i) => !(i.qty >= 1))) {
      alert("Pastikan nama supplier, barang, dan kuantitas diisi dengan benar.");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/returns/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierName: supplierFormData.supplierName,
          items: supplierItems.map((i) => ({ productId: i.product.id, quantity: i.qty })),
          reason: supplierFormData.reason
        })
      });

      const json = await res.json();
      if (json.success) {
        setIsSupplierFormOpen(false);
        setSupplierFormData({ supplierName: "", reason: "" });
        setSupplierItems([]);
        fetchReturns();
      } else {
        alert(json.message || "Gagal mengajukan retur");
      }
    } catch (e) {
      console.error(e);
      alert("Terjadi kesalahan jaringan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusUpdate = async (id: number, newStatus: string) => {
    if (!(await confirm({ title: `Ubah status retur menjadi ${newStatus}?`, confirmLabel: "Ya, ubah" }))) return;
    
    try {
      const res = await fetch(`/api/returns?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      const json = await res.json();
      if (json.success) {
        fetchReturns();
        setIsDetailOpen(false);
      } else {
        alert("Gagal: " + json.message);
      }
    } catch (e) {
      console.error(e);
      alert("Terjadi kesalahan.");
    }
  };

  const [activeTab, setActiveTab] = useState<"penjualan" | "pembelian">("penjualan");

  const filteredReturns = returns.filter((ret) => {
    const isPembelian = ret.isPurchaseReturn || ret.supplierName || (ret.reason && ret.reason.startsWith('[SUPPLIER]'));
    
    if (activeTab === "penjualan" && isPembelian) return false;
    if (activeTab === "pembelian" && !isPembelian) return false;

    const matchesSearch =
      ret.returnNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ret.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ret.supplierName && ret.supplierName.toLowerCase().includes(searchQuery.toLowerCase()));
      
    return matchesSearch;
  });

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-6xl mx-auto bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Retur Barang
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manajemen pengembalian barang dari pelanggan atau kerusakan stok.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsFormOpen(true)} className="gap-2 bg-brand-green hover:bg-brand-green-dark">
            <PlusCircle className="w-4 h-4" />
            Retur Pelanggan
          </Button>
          <Button onClick={() => setIsSupplierFormOpen(true)} className="gap-2 bg-brand-orange hover:bg-brand-orange/90">
            <PlusCircle className="w-4 h-4" />
            Retur Supplier
          </Button>
        </div>
      </div>

      <div className="flex space-x-4 border-b border-slate-200">
        <button 
          className={`pb-2 px-1 font-medium text-sm transition-colors ${activeTab === 'penjualan' ? 'border-b-2 border-brand-green text-brand-green' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('penjualan')}
        >
          Retur Penjualan (Pelanggan)
        </button>
        <button 
          className={`pb-2 px-1 font-medium text-sm transition-colors ${activeTab === 'pembelian' ? 'border-b-2 border-brand-orange text-brand-orange' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('pembelian')}
        >
          Retur Pembelian (Supplier)
        </button>
      </div>

      <div className="bg-white border rounded-xl shadow-sm p-4 flex flex-col md:flex-row gap-4 justify-between">
        <div className="flex flex-1 gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari no. retur atau transaksi..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "semua")}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua Status</SelectItem>
              <SelectItem value="pending">Menunggu</SelectItem>
              <SelectItem value="disetujui">Disetujui</SelectItem>
              <SelectItem value="ditolak">Ditolak</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button 
          variant="outline" 
          className="gap-2 text-green-700 border-green-200 hover:bg-green-50"
          onClick={() => window.location.href = '/api/returns/excel'}
        >
          Unduh Laporan
        </Button>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white border rounded-xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/80">
            <TableRow>
              <TableHead>Nomor Retur</TableHead>
              <TableHead>Tanggal</TableHead>
              {activeTab === 'penjualan' ? <TableHead>No. Transaksi</TableHead> : <TableHead>Supplier</TableHead>}
              <TableHead>Nama Barang</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  Memuat data...
                </TableCell>
              </TableRow>
            ) : filteredReturns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <RotateCcw className="w-12 h-12 mb-4 text-slate-200" />
                    <p>Tidak ada data retur yang ditemukan.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredReturns.map((ret) => (
                <TableRow key={ret.id} className="hover:bg-slate-50/50">
                  <TableCell className="font-medium text-brand-green">{ret.returnNumber}</TableCell>
                  <TableCell>{new Date(ret.createdAt).toLocaleString("id-ID")}</TableCell>
                  <TableCell>
                    {activeTab === 'penjualan' ? (ret.transactionId || "-") : (ret.supplierName || (ret.reason?.startsWith('[SUPPLIER] ') ? ret.reason.split('|')[0].replace('[SUPPLIER] ', '') : "-"))}
                  </TableCell>
                  <TableCell>{ret.productName}</TableCell>
                  <TableCell>{ret.quantity}</TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={
                        ret.status === "disetujui"
                          ? "bg-green-100 text-green-800"
                          : ret.status === "ditolak"
                          ? "bg-red-100 text-red-800"
                          : "bg-amber-100 text-amber-800"
                      }
                    >
                      {ret.status.charAt(0).toUpperCase() + ret.status.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedReturn(ret);
                        setIsDetailOpen(true);
                      }}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Detail
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
          <div className="text-center py-10 text-slate-500 border rounded-xl bg-white shadow-sm">
            Memuat data...
          </div>
        ) : filteredReturns.length === 0 ? (
          <div className="text-center py-10 border rounded-xl bg-white shadow-sm flex flex-col items-center">
            <RotateCcw className="w-12 h-12 mb-4 text-slate-200" />
            <p className="text-muted-foreground">Tidak ada data retur yang ditemukan.</p>
          </div>
        ) : (
          filteredReturns.map((ret) => (
            <div key={ret.id} className="bg-white border rounded-xl shadow-sm p-4 flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-brand-green">{ret.returnNumber}</div>
                  <div className="text-xs text-slate-500">{new Date(ret.createdAt).toLocaleString("id-ID")}</div>
                </div>
                <Badge
                  variant="secondary"
                  className={
                    ret.status === "disetujui"
                      ? "bg-green-100 text-green-800 text-[10px] px-1.5 py-0"
                      : ret.status === "ditolak"
                      ? "bg-red-100 text-red-800 text-[10px] px-1.5 py-0"
                      : "bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0"
                  }
                >
                  {ret.status.charAt(0).toUpperCase() + ret.status.slice(1)}
                </Badge>
              </div>
              
              <div className="border-t border-slate-100 pt-3">
                <div className="font-semibold text-slate-900 leading-tight">{ret.productName}</div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <div className="text-xs text-slate-400">Qty</div>
                    <div className="font-medium text-slate-700">{ret.quantity}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">{activeTab === 'penjualan' ? 'No. Transaksi' : 'Supplier'}</div>
                    <div className="font-medium text-slate-700 truncate">
                      {activeTab === 'penjualan' ? (ret.transactionId || "-") : (ret.supplierName || (ret.reason?.startsWith('[SUPPLIER] ') ? ret.reason.split('|')[0].replace('[SUPPLIER] ', '') : "-"))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-brand-green border-brand-green/30 hover:bg-brand-green/10"
                  onClick={() => {
                    setSelectedReturn(ret);
                    setIsDetailOpen(true);
                  }}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Lihat Detail
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Ajukan Retur Barang</DialogTitle>
            <DialogDescription>
              Masukkan detail barang yang dikembalikan pelanggan.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmitReturn} className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="transactionId">No. Transaksi (Opsional)</Label>
              <Input
                id="transactionId"
                name="transactionId"
                placeholder="Misal: TRX-12345"
                value={formData.transactionId}
                onChange={handleInputChange}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="productId">Barang yang Diretur</Label>
              <ProductPicker
                value={customerProduct}
                onChange={(p) => {
                  setCustomerProduct(p);
                  setFormData(prev => ({ ...prev, productId: p?.id ?? "" }));
                }}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="qty">Kuantitas</Label>
              <Input
                id="qty"
                name="qty"
                type="number"
                min="1"
                value={formData.qty}
                onChange={handleInputChange}
                required
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="reason">Alasan Retur</Label>
              <Input
                id="reason"
                name="reason"
                placeholder="Cth: Kemasan rusak, salah barang..."
                value={formData.reason}
                onChange={handleInputChange}
                required
              />
            </div>
            
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting || !formData.productId}>
                {isSubmitting ? "Menyimpan..." : "Simpan Retur"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Form Dialog Supplier Return */}
      <Dialog open={isSupplierFormOpen} onOpenChange={setIsSupplierFormOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Ajukan Retur Pembelian (ke Supplier)</DialogTitle>
            <DialogDescription>
              Kembalikan barang rusak/kadaluarsa ke supplier. Stok barang akan otomatis berkurang.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmitSupplierReturn} className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="supplierName">Nama Supplier</Label>
              <Input
                id="supplierName"
                name="supplierName"
                placeholder="Misal: PT Wingsfood"
                value={supplierFormData.supplierName}
                onChange={handleSupplierInputChange}
                required
              />
            </div>
            
            <div className="grid gap-2">
              <Label>Barang yang Diretur</Label>
              <ProductSearch
                disableOutOfStock
                onSelect={(p) => setSupplierItems((prev) => (prev.some((i) => i.product.id === p.id) ? prev : [...prev, { product: p, qty: 1 }]))}
              />
              {supplierItems.length > 0 && (
                <div className="space-y-2 max-h-[40vh] overflow-auto">
                  {supplierItems.map((item) => (
                    <div key={item.product.id} className="flex items-center gap-2 rounded-md border bg-slate-50 p-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{item.product.name}</div>
                        <div className="text-xs text-slate-500">Stok {item.product.stock}</div>
                      </div>
                      <Input
                        type="number"
                        min="1"
                        max={item.product.stock}
                        aria-label={`Jumlah retur ${item.product.name}`}
                        value={item.qty}
                        onChange={(e) => setSupplierItems((prev) => prev.map((i) => (i.product.id === item.product.id ? { ...i, qty: Number(e.target.value) } : i)))}
                        className="w-20 text-center"
                        required
                      />
                      <Button type="button" variant="ghost" size="sm" className="text-red-500 px-2" aria-label={`Hapus ${item.product.name}`}
                        onClick={() => setSupplierItems((prev) => prev.filter((i) => i.product.id !== item.product.id))}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="reasonSup">Alasan Retur</Label>
              <Input
                id="reasonSup"
                name="reason"
                placeholder="Cth: Kadaluarsa, cacat pabrik..."
                value={supplierFormData.reason}
                onChange={handleSupplierInputChange}
                required
              />
            </div>
            
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setIsSupplierFormOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting || supplierItems.length === 0}>
                {isSubmitting ? "Menyimpan..." : "Simpan Retur Supplier"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Detail Retur: {selectedReturn?.returnNumber}</DialogTitle>
          </DialogHeader>
          
          {selectedReturn && (
            <div className="space-y-4 py-2 text-sm">
              <div className="grid grid-cols-3 gap-2 py-2 border-b">
                <div className="text-muted-foreground">Waktu Pengajuan</div>
                <div className="col-span-2 font-medium">
                  {new Date(selectedReturn.createdAt).toLocaleString("id-ID")}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 py-2 border-b">
                <div className="text-muted-foreground">No. Transaksi</div>
                <div className="col-span-2 font-medium">
                  {selectedReturn.transactionId || "-"}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 py-2 border-b">
                <div className="text-muted-foreground">Barang</div>
                <div className="col-span-2 font-medium">
                  {selectedReturn.productName} ({selectedReturn.quantity} item)
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 py-2 border-b">
                <div className="text-muted-foreground">Alasan</div>
                <div className="col-span-2 font-medium text-red-600">
                  &ldquo;{selectedReturn.reason}&rdquo;
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 py-2 border-b">
                <div className="text-muted-foreground">Status</div>
                <div className="col-span-2">
                  <Badge
                    variant="secondary"
                    className={
                      selectedReturn.status === "disetujui"
                        ? "bg-green-100 text-green-800"
                        : selectedReturn.status === "ditolak"
                        ? "bg-red-100 text-red-800"
                        : "bg-amber-100 text-amber-800"
                    }
                  >
                    {selectedReturn.status.charAt(0).toUpperCase() + selectedReturn.status.slice(1)}
                  </Badge>
                </div>
              </div>
              
              {selectedReturn.processedBy && (
                <div className="grid grid-cols-3 gap-2 py-2 border-b">
                  <div className="text-muted-foreground">Diproses Oleh</div>
                  <div className="col-span-2 font-medium">
                    {selectedReturn.processedByName} pada {selectedReturn.processedAt ? new Date(selectedReturn.processedAt).toLocaleString("id-ID") : ""}
                  </div>
                </div>
              )}

              {selectedReturn.status === "pending" && userRole === "manajer" && (
                <div className="flex gap-2 justify-end pt-4">
                  <Button 
                    variant="outline" 
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => handleStatusUpdate(selectedReturn.id, "ditolak")}
                  >
                    Tolak Retur
                  </Button>
                  <Button 
                    className="bg-green-700 hover:bg-green-800 text-white"
                    onClick={() => handleStatusUpdate(selectedReturn.id, "disetujui")}
                  >
                    Setujui & Kembalikan Stok
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}
