/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
"use client";

import { useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle, ArrowRight, Eye, Download, AlertCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface PreviewItem {
  row: number;
  name: string;
  sku: string;
  price: number;
  valid: boolean;
}

export default function ImportPage() {
  const [step, setStep] = useState(1);
  const [entity, setEntity] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<PreviewItem[] | null>(null);
  const [previewErrors, setPreviewErrors] = useState<{row: number, message: string}[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Mock processing step 2 -> 3
  const handleNextStep = async () => {
    if (step === 2 && file && entity) {
      setIsProcessing(true);
      
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entity", entity);
      
      try {
        const res = await fetch("/api/import/preview", {
          method: "POST",
          body: formData,
        });
        
        const json = await res.json();
        
        if (!res.ok) {
          setFileError(json.error || "Gagal membaca berkas.");
          setIsProcessing(false);
          return;
        }
        
        setPreviewData(json.data);
        setPreviewErrors(json.errors || []);
        setStep(3);
      } catch (err) {
        setFileError("Terjadi kesalahan jaringan.");
      } finally {
        setIsProcessing(false);
      }
    } else if (step === 3 && file && entity) {
      setIsProcessing(true);
      
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entity", entity);
      
      try {
        const res = await fetch("/api/import/save", {
          method: "POST",
          body: formData,
        });
        
        const json = await res.json();
        
        if (!res.ok) {
          alert(json.error || "Gagal menyimpan data.");
          setIsProcessing(false);
          return;
        }
        
        // Save success result in state to show in step 4
        (window as any).importSummary = json.summary;
        setStep(4);
      } catch (err) {
        alert("Terjadi kesalahan jaringan saat menyimpan data.");
      } finally {
        setIsProcessing(false);
      }
    } else {
      setStep(Math.min(4, step + 1));
    }
  };

  const handleDownloadTemplate = () => {
    if (!entity) return;
    // Mock template download for frontend layer
    alert(`Mengunduh template untuk ${entity}...`);
    window.open(`/api/import/template?entity=${entity}`, '_blank');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) {
      setFile(null);
      setFileError(null);
      return;
    }
    
    if (!selected.name.endsWith('.xlsx')) {
      setFile(null);
      setFileError("Format berkas tidak valid. Harap unggah berkas .xlsx");
      return;
    }
    
    setFile(selected);
    setFileError(null);
  };

  const steps = [
    { id: 1, title: "Pilih Entitas", icon: <FileSpreadsheet className="w-4 h-4" /> },
    { id: 2, title: "Unggah Berkas", icon: <Upload className="w-4 h-4" /> },
    { id: 3, title: "Pratinjau", icon: <Eye className="w-4 h-4" /> },
    { id: 4, title: "Selesai", icon: <CheckCircle className="w-4 h-4" /> },
  ];

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Impor Data</h2>
      </div>

      <div className="mb-8 overflow-hidden px-4 md:px-12 py-4">
        <div className="flex items-center justify-between relative max-w-3xl mx-auto">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-100 z-0 rounded-full" />
          <div 
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-slate-900 z-0 rounded-full transition-all duration-300"
            style={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}
          />
          
          {steps.map((s) => (
            <div key={s.id} className="relative z-10 flex flex-col items-center gap-2">
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors duration-300
                  ${step > s.id ? 'bg-slate-900 border-slate-900 text-white' : 
                    step === s.id ? 'bg-white border-slate-900 text-slate-900' : 
                    'bg-white border-slate-200 text-slate-400'}`}
              >
                {s.icon}
              </div>
              <span className={`text-xs md:text-sm font-medium absolute -bottom-6 w-max text-center ${step >= s.id ? 'text-slate-900' : 'text-slate-400'}`}>
                {s.title}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Card className="max-w-3xl mx-auto mt-12">
        <CardHeader>
          <CardTitle>Langkah {step}: {steps[step-1].title}</CardTitle>
          <CardDescription>
            Ikuti panduan untuk mengimpor data dari berkas Excel (.xlsx).
          </CardDescription>
        </CardHeader>
        <CardContent className="min-h-[300px]">
          {step === 1 && (
            <div className="space-y-6">
              <p className="text-slate-500">Pilih jenis data yang ingin Anda impor ke sistem.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { id: "products", title: "Barang (Produk)", desc: "Impor katalog barang, harga, dan jumlah stok." },
                  { id: "categories", title: "Kategori Barang", desc: "Impor daftar kategori barang." },
                  { id: "purchase-orders", title: "Purchase Order (PO)", desc: "Impor riwayat pesanan pembelian dari pemasok." },
                  { id: "returns", title: "Retur", desc: "Impor data retur pembelian atau penjualan." }
                ].map((item) => (
                  <Card 
                    key={item.id}
                    className={`cursor-pointer transition-all hover:border-slate-400 ${entity === item.id ? 'border-slate-900 ring-1 ring-slate-900 bg-slate-50' : 'border-slate-200'}`}
                    onClick={() => setEntity(item.id)}
                  >
                    <CardHeader className="p-4">
                      <CardTitle className="text-base">{item.title}</CardTitle>
                      <CardDescription className="text-xs">{item.desc}</CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-6">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h3 className="font-medium text-slate-900 capitalize">Template {entity?.replace("-", " ")}</h3>
                  <p className="text-sm text-slate-500">Unduh template kosong untuk melihat format yang dibutuhkan.</p>
                </div>
                <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={handleDownloadTemplate}>
                  <Download className="w-4 h-4" />
                  Unduh Template
                </Button>
              </div>

              <div className="border-2 border-dashed border-slate-200 rounded-xl p-10 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center mb-4">
                  <Upload className="w-6 h-6" />
                </div>
                <h3 className="font-medium text-slate-900 mb-1">Unggah Berkas Excel</h3>
                <p className="text-sm text-slate-500 mb-4">Hanya menerima format .xlsx (maks. 5MB)</p>
                
                <input 
                  type="file" 
                  id="file-upload" 
                  className="hidden" 
                  accept=".xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={handleFileChange}
                />
                
                {file ? (
                  <div className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-md border border-green-200 w-full max-w-sm justify-between">
                    <div className="flex items-center gap-2 truncate">
                      <FileSpreadsheet className="w-4 h-4 shrink-0" />
                      <span className="text-sm font-medium truncate">{file.name}</span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-green-100 text-green-800" onClick={() => { setFile(null); (document.getElementById('file-upload') as HTMLInputElement).value = ''; }}>
                      <span className="text-xl leading-none">&times;</span>
                    </Button>
                  </div>
                ) : (
                  <Button asChild>
                    <label htmlFor="file-upload" className="cursor-pointer">
                      Pilih Berkas
                    </label>
                  </Button>
                )}

                {fileError && (
                  <p className="text-red-500 text-sm mt-3 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {fileError}
                  </p>
                )}
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-slate-900">Pratinjau Data</h3>
                  <p className="text-sm text-slate-500">Periksa kembali data sebelum disimpan.</p>
                </div>
                {previewErrors.length > 0 ? (
                  <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-1.5 rounded-md border border-red-200">
                    <XCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">{previewErrors.length} Baris Bermasalah</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-green-700 bg-green-50 px-3 py-1.5 rounded-md border border-green-200">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Semua Data Valid</span>
                  </div>
                )}
              </div>
              
              {previewErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
                  <h4 className="text-sm font-bold text-red-900 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> Impor Dibatalkan
                  </h4>
                  <p className="text-sm text-red-700">Terdapat kesalahan pada data. Perbaiki baris di bawah pada berkas Excel Anda lalu unggah ulang.</p>
                  <ul className="list-disc pl-5 text-sm text-red-800 mt-2 space-y-1">
                    {previewErrors.map((err, i) => (
                      <li key={i}><strong>Baris {err.row}:</strong> {err.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="border rounded-xl overflow-hidden bg-white shadow-sm overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-16">Baris</TableHead>
                      <TableHead>Identitas</TableHead>
                      <TableHead>Referensi/Kode</TableHead>
                      <TableHead className="w-24 text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData?.map((item, i) => (
                      <TableRow key={i} className={!item.valid ? "bg-red-50/50" : ""}>
                        <TableCell className="font-medium text-slate-500">{item.row}</TableCell>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>{item.sku}</TableCell>
                        <TableCell className="text-center">
                          {item.valid ? (
                            <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500 mx-auto" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          {step === 4 && (
            <div className="flex flex-col items-center justify-center text-center py-10 space-y-6">
              <div className="bg-slate-50 border rounded-xl p-8 max-w-md mx-auto text-center w-full">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Impor Berhasil</h3>
                <p className="text-slate-500 mb-6">
                  Data telah berhasil ditambahkan dan diperbarui di sistem.
                </p>
                <div className="grid grid-cols-2 gap-4 mb-6 text-left">
                  <div className="bg-white p-4 rounded-lg border text-center">
                    <div className="text-sm text-slate-500 mb-1">Baris Baru</div>
                    <div className="text-2xl font-semibold">{(window as any).importSummary?.added || 0}</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg border text-center">
                    <div className="text-sm text-slate-500 mb-1">Diperbarui</div>
                    <div className="text-2xl font-semibold text-blue-600">{(window as any).importSummary?.updated || 0}</div>
                  </div>
                </div>
                <Button 
                  className="w-full"
                  onClick={() => {
                    setStep(1);
                    setFile(null);
                    setPreviewData([]);
                    setPreviewErrors([]);
                    setEntity("");
                  }}
                >
                  Impor Berkas Baru
                </Button>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between border-t p-6">
          <Button 
            variant="outline" 
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1 || step === 4 || isProcessing}
          >
            Kembali
          </Button>
          <Button 
            onClick={handleNextStep} 
            disabled={
              isProcessing || 
              (step === 1 && !entity) || 
              (step === 2 && !file) ||
              (step === 3 && previewErrors.length > 0) ||
              (step === 4)
            }
            className={step === 4 ? "hidden" : ""}
          >
            {isProcessing ? "Memproses..." : (step === 3 ? "Simpan Data" : "Selanjutnya")}
            {!isProcessing && step < 3 && <ArrowRight className="w-4 h-4 ml-2" />}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}