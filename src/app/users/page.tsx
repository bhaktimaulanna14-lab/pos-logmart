/* eslint-disable */
// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Search, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";



export default function UsersPage() {
  
  const [searchTerm, setSearchTerm] = useState("");
  const [usersData, setUsersData] = useState<Record<string, any>[]>([]);
  useEffect(() => {
    fetch('/api/users')
      .then(res => res.json())
      .then(json => {
        if(json.success) setUsersData(json.data);
      });
  }, []);


  const filteredUsers = usersData.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 md:p-10 space-y-6 max-w-6xl mx-auto bg-slate-50 min-h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Kelola Pengguna
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Atur hak akses staf dan kasir.
            </p>
          </div>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" /> Tambah Pengguna
        </Button>
      </div>

      <div className="bg-white p-4 rounded-xl border shadow-sm space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Cari nama atau username..." 
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block rounded-md border overflow-hidden bg-white">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-slate-600 font-medium border-b">
              <tr>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Peran</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{user.name}</td>
                    <td className="px-4 py-3 text-slate-600">@{user.username}</td>
                    <td className="px-4 py-3">
                      <Badge variant={user.role === "manajer" ? "default" : "outline"} className="capitalize">
                        {user.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={user.status === "Aktif" ? "secondary" : "destructive"}>
                        {user.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <Button variant="ghost" size="sm" className="h-8 px-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 px-2 text-slate-600 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    Tidak ada pengguna ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden flex flex-col gap-3 pb-8">
          {filteredUsers.length > 0 ? (
            filteredUsers.map((user) => (
              <div key={user.id} className="bg-white border rounded-lg p-4 shadow-sm flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-slate-900 text-lg leading-none">{user.name}</div>
                    <div className="text-sm text-slate-500 mt-1">@{user.username}</div>
                  </div>
                  <Badge variant={user.status === "Aktif" ? "secondary" : "destructive"} className="text-[10px] px-1.5 py-0">
                    {user.status}
                  </Badge>
                </div>
                
                <div className="flex justify-between items-end border-t border-slate-100 pt-3 mt-1">
                  <div>
                    <div className="text-xs text-slate-400 mb-1">Peran</div>
                    <Badge variant={user.role === "manajer" ? "default" : "outline"} className="capitalize text-[10px] px-1.5 py-0">
                      {user.role}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-slate-600 border-slate-200">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-red-600 border-red-200 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-slate-500 border rounded-lg bg-slate-50">
              Tidak ada pengguna ditemukan.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
