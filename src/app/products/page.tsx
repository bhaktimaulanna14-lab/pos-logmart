/* eslint-disable */
// @ts-nocheck
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { PlusCircle, Search, Edit, Trash2, AlertCircle, Printer, Loader2, Package } from "lucide-react";

type Product = {
  id: string;
  barcode: string;
  name: string;
  categoryId: string;
  categoryName: string;
  price: number;
  cost: number;
  stockQty: number;
  minStock: number;
  isActive: boolean;
};

type Category = {
  id: string;
  name: string;
  description: string | null;
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Modals state
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);

  // Selection
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // --- Data Fetching ---

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/categories");
      const json = await res.json();
      if (json.success) setCategories(json.data);
    } catch (e) {
      console.error("Failed to fetch categories", e);
    }
  }, []);

  const fetchProducts = useCallback(async (search: string, catId: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("q", search);
      if (catId && catId !== "all") params.append("categoryId", catId);
      
      const res = await fetch(`/api/products?${params.toString()}`);
      const json = await res.json();
      if (json.success) setProducts(json.data);
    } catch (e) {
      console.error("Failed to fetch products", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchProducts(searchTerm, categoryFilter);
  }, [searchTerm, categoryFilter, fetchProducts]);

  const handleSearchChange = (val: string) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    // Let user type fast, update UI state first, then fetch
    searchTimeout.current = setTimeout(() => {
      setSearchTerm(val);
    }, 500);
  };

  // --- Category Management ---

  const handleAddCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          description: formData.get("description"),
        }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchCategories();
        e.currentTarget.reset();
      } else {
        alert(json.message);
      }
    } catch (e) {
      console.error(e);
      alert("Terjadi kesalahan");
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Hapus kategori ini?")) return;
    try {
      const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        await fetchCategories();
      } else {
        alert(json.message);
      }
    } catch (e) {
      console.error(e);
      alert("Terjadi kesalahan");
    }
  };

  // --- Product Management ---

  const handleSaveProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    const formData = new FormData(e.currentTarget);
    const productData = {
      barcode: formData.get("barcode") as string,
      name: formData.get("name") as string,
      categoryId: formData.get("categoryId") as string,
      price: Number(formData.get("price")),
      cost: Number(formData.get("cost")),
      stockQty: Number(formData.get("stockQty")),
      minStock: Number(formData.get("minStock")),
      isActive: true,
    };

    try {
      let res;
      if (editingProduct) {
        res = await fetch(`/api/products/${editingProduct.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(productData),
        });
      } else {
        res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(productData),
        });
      }
      
      const json = await res.json();
      if (json.success) {
        setIsProductDialogOpen(false);
        setEditingProduct(null);
        await fetchProducts(searchTerm, categoryFilter);
      } else {
        alert(json.message);
      }
    } catch (e) {
      console.error(e);
      alert("Terjadi kesalahan");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Nonaktifkan barang ini?")) return;
    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        await fetchProducts(searchTerm, categoryFilter);
      } else {
        alert(json.message);
      }
    } catch (e) {
      console.error(e);
      alert("Terjadi kesalahan");
    }
  };

  // --- Print Labels ---

  const handlePrintLabels = () => {
    if (selectedProducts.size === 0) return;
    const ids = Array.from(selectedProducts).join(",");
    fetch(`/api/products/labels?ids=${ids}`)
      .then(async res => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || "Gagal mencetak label");
        }
        return res.blob();
      })
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "label_harga.pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setIsPreviewDialogOpen(false);
        setSelectedProducts(new Set());
      })
      .catch(err => {
        alert("Error: " + err.message);
      });
  };

  // --- Selection Logic ---

  const toggleProductSelection = (id: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedProducts(newSelected);
  };

  const toggleAllSelection = () => {
    if (products.length === 0) return;
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(products.map(p => p.id)));
    }
  };

  const lowStockProducts = products.filter(p => p.stockQty <= p.minStock);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manajemen Barang</h1>
          <p className="text-muted-foreground">Kelola daftar barang, harga, dan stok toko.</p>
        </div>
        
        <div className="flex gap-2">
          {selectedProducts.size > 0 && (
            <>
              <Button variant="secondary" className="flex items-center gap-2" onClick={() => setIsPreviewDialogOpen(true)}>
                <Printer className="w-4 h-4" /> Cetak Label ({selectedProducts.size})
              </Button>

              <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
                <DialogContent className="sm:max-w-[600px]">
                  <DialogHeader>
                    <DialogTitle>Pratinjau Label ({selectedProducts.size} Barang)</DialogTitle>
                    <DialogDescription>Pastikan kertas ukuran A4 / label sudah sesuai sebelum mencetak.</DialogDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto p-2 border rounded bg-slate-50">
                    {products.filter(p => selectedProducts.has(p.id)).map(product => (
                      <div key={product.id} className="bg-white border p-3 flex flex-col items-center text-center justify-center rounded shadow-sm">
                        <div className="font-bold text-sm leading-tight mb-1">{product.name}</div>
                        <div className="text-xs text-muted-foreground mb-2">{product.barcode}</div>
                        <div className="font-mono font-semibold text-lg">{formatCurrency(product.price)}</div>
                      </div>
                    ))}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsPreviewDialogOpen(false)}>Batal</Button>
                    <Button onClick={handlePrintLabels}>Cetak Sekarang</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}

          {/* Manage Categories */}
          <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">Kelola Kategori</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Kategori Barang</DialogTitle>
                <DialogDescription>Kelola kategori untuk mengelompokkan barang.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <form onSubmit={handleAddCategory} className="flex gap-2 items-end">
                  <div className="space-y-2 flex-1">
                    <Label htmlFor="cat_name">Nama</Label>
                    <Input id="cat_name" name="name" required />
                  </div>
                  <div className="space-y-2 flex-1">
                    <Label htmlFor="cat_desc">Deskripsi</Label>
                    <Input id="cat_desc" name="description" />
                  </div>
                  <Button type="submit">Tambah</Button>
                </form>

                <div className="mt-4 max-h-[300px] overflow-y-auto">
                  <div className="hidden md:block border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nama</TableHead>
                          <TableHead>Deskripsi</TableHead>
                          <TableHead className="w-[80px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categories.map((cat) => (
                          <TableRow key={cat.id}>
                            <TableCell className="font-medium">{cat.name}</TableCell>
                            <TableCell>{cat.description}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDeleteCategory(cat.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {categories.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground py-4">Belum ada kategori</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  
                  <div className="md:hidden flex flex-col gap-2">
                    {categories.length === 0 ? (
                      <div className="text-center text-muted-foreground py-4 border rounded-md">Belum ada kategori</div>
                    ) : (
                      categories.map((cat) => (
                        <div key={cat.id} className="flex items-center justify-between p-3 border rounded-md">
                          <div>
                            <div className="font-bold">{cat.name}</div>
                            <div className="text-sm text-slate-500">{cat.description || "-"}</div>
                          </div>
                          <Button variant="ghost" size="icon" className="text-red-500 shrink-0" onClick={() => handleDeleteCategory(cat.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Add/Edit Product Dialog */}
          <Dialog open={isProductDialogOpen} onOpenChange={(open) => { setIsProductDialogOpen(open); if(!open) setEditingProduct(null); }}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2" onClick={() => { setEditingProduct(null); setIsProductDialogOpen(true); }}>
                <PlusCircle className="w-4 h-4" /> Tambah Barang
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{editingProduct ? "Ubah Barang" : "Tambah Barang Baru"}</DialogTitle>
                <DialogDescription>
                  {editingProduct ? "Ubah detail barang ini." : "Masukkan detail barang yang akan ditambahkan ke sistem."}
                </DialogDescription>
              </DialogHeader>
              <form key={editingProduct ? editingProduct.id : 'new'} onSubmit={handleSaveProduct} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="barcode">Barcode</Label>
                  <Input id="barcode" name="barcode" defaultValue={editingProduct?.barcode} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Nama Barang</Label>
                  <Input id="name" name="name" defaultValue={editingProduct?.name} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="categoryId">Kategori</Label>
                  <Select name="categoryId" defaultValue={editingProduct?.categoryId || ""}>
                    <SelectTrigger id="categoryId">
                      <SelectValue placeholder="Pilih kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cost">Harga Modal</Label>
                    <Input id="cost" name="cost" type="number" min="0" defaultValue={editingProduct?.cost} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Harga Jual</Label>
                    <Input id="price" name="price" type="number" min="0" defaultValue={editingProduct?.price} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="stockQty">Stok Aktual</Label>
                    <Input id="stockQty" name="stockQty" type="number" min="0" defaultValue={editingProduct?.stockQty ?? 0} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minStock">Stok Minimum</Label>
                    <Input id="minStock" name="minStock" type="number" min="0" defaultValue={editingProduct?.minStock ?? 5} required />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsProductDialogOpen(false)}>Batal</Button>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Simpan
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {lowStockProducts.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Peringatan Stok!</AlertTitle>
          <AlertDescription>
            Terdapat {lowStockProducts.length} barang dengan stok di bawah minimum. Silakan lakukan pemesanan ulang ke supplier.
          </AlertDescription>
        </Alert>
      )}

      {/* Filter / Search Bar */}
      <div className="flex items-center gap-4 py-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari barcode atau nama barang..."
            className="pl-8"
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
        <div className="w-[200px]">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Semua Kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kategori</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isLoading && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
      </div>

      {/* Products Table Desktop */}
      <div className="hidden md:block border rounded-md bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox 
                  checked={products.length > 0 && selectedProducts.size === products.length}
                  onCheckedChange={toggleAllSelection}
                  aria-label="Pilih semua"
                />
              </TableHead>
              <TableHead>Barcode</TableHead>
              <TableHead>Nama Barang</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead className="text-right">Harga Jual</TableHead>
              <TableHead className="text-right">Harga Modal</TableHead>
              <TableHead className="text-center">Stok</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-64 text-center text-muted-foreground">
                    {isLoading ? (
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                        <span>Memuat barang...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                          <Package className="w-6 h-6 text-slate-400" />
                        </div>
                        <div className="text-lg font-medium text-slate-900">Belum ada barang</div>
                        <p className="text-sm text-slate-500 max-w-sm mx-auto">
                          Katalog barang Anda saat ini masih kosong. Silakan tambah barang baru atau impor dari file Excel untuk memulai.
                        </p>
                        <Button onClick={() => { setEditingProduct(null); setIsProductDialogOpen(true); }} variant="outline" className="mt-2">
                          <PlusCircle className="w-4 h-4 mr-2" />
                          Tambah Barang Pertama
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
              products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <Checkbox 
                      checked={selectedProducts.has(product.id)}
                      onCheckedChange={() => toggleProductSelection(product.id)}
                      aria-label={`Pilih ${product.name}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{product.barcode}</TableCell>
                  <TableCell>{product.name}</TableCell>
                  <TableCell>{product.categoryName || "-"}</TableCell>
                  <TableCell className="text-right">{formatCurrency(product.price)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(product.cost)}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={product.stockQty <= 0 ? "destructive" : product.stockQty <= product.minStock ? "secondary" : "default"}>
                      {product.stockQty}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {product.isActive ? (
                      <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">Aktif</Badge>
                    ) : (
                      <Badge variant="outline" className="text-red-600 bg-red-50 border-red-200">Nonaktif</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" title="Edit" onClick={() => { setEditingProduct(product); setIsProductDialogOpen(true); }}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Hapus" className="text-red-500 hover:text-red-600" onClick={() => handleDeleteProduct(product.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Products Cards Mobile */}
      <div className="md:hidden flex flex-col gap-3 pb-8">
        {/* Select All Checkbox Mobile */}
        {products.length > 0 && (
          <div className="flex items-center gap-3 p-3 bg-white border rounded-lg shadow-sm">
            <Checkbox 
              id="select-all-mobile"
              checked={products.length > 0 && selectedProducts.size === products.length}
              onCheckedChange={toggleAllSelection}
            />
            <Label htmlFor="select-all-mobile" className="font-medium">Pilih Semua ({selectedProducts.size}/{products.length})</Label>
          </div>
        )}

        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-white border rounded-lg shadow-sm">
            {isLoading ? (
              <div className="flex flex-col items-center space-y-2">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                <span className="text-muted-foreground">Memuat barang...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                  <Package className="w-6 h-6 text-slate-400" />
                </div>
                <div className="text-lg font-medium text-slate-900">Belum ada barang</div>
                <p className="text-sm text-slate-500">
                  Katalog barang Anda saat ini masih kosong. Silakan tambah barang baru atau impor dari file Excel.
                </p>
                <Button onClick={() => { setEditingProduct(null); setIsProductDialogOpen(true); }} variant="outline" className="mt-2 w-full">
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Tambah Barang Pertama
                </Button>
              </div>
            )}
          </div>
        ) : (
          products.map((product) => (
            <div key={product.id} className="flex flex-col bg-white border rounded-lg shadow-sm overflow-hidden">
              <div className="flex items-center justify-between p-3 border-b bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <Checkbox 
                    checked={selectedProducts.has(product.id)}
                    onCheckedChange={() => toggleProductSelection(product.id)}
                    aria-label={`Pilih ${product.name}`}
                  />
                  <div className="font-mono text-sm text-slate-500">{product.barcode}</div>
                </div>
                <div className="flex items-center gap-2">
                  {product.isActive ? (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-600 bg-green-50 border-green-200">Aktif</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-red-600 bg-red-50 border-red-200">Nonaktif</Badge>
                  )}
                </div>
              </div>
              <div className="p-4 flex flex-col gap-3">
                <div>
                  <h3 className="font-bold text-slate-900 leading-tight">{product.name}</h3>
                  <div className="text-sm text-slate-500 mt-1">{product.categoryName || "Tanpa Kategori"}</div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                  <div>
                    <div className="text-xs text-slate-400 mb-1">Harga Modal</div>
                    <div className="font-medium text-slate-700">{formatCurrency(product.cost)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-1">Harga Jual</div>
                    <div className="font-bold text-brand-orange">{formatCurrency(product.price)}</div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600 font-medium">Stok:</span>
                    <Badge variant={product.stockQty <= 0 ? "destructive" : product.stockQty <= product.minStock ? "secondary" : "default"}>
                      {product.stockQty}
                    </Badge>
                  </div>
                  
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Edit" onClick={() => { setEditingProduct(product); setIsProductDialogOpen(true); }}>
                      <Edit className="w-4 h-4 text-brand-green" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-600" title="Hapus" onClick={() => handleDeleteProduct(product.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
