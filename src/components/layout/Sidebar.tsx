/* eslint-disable */
// @ts-nocheck
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Truck, 
  BarChart3, 
  History, 
  Users,
  LogOut,
  Menu,
  Store,
  RotateCcw,
  Upload
} from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";
import { Logo } from "@/components/brand/Logo";
import { useRouter } from "next/navigation";

const navItems = [
  { name: "Beranda", href: "/", icon: LayoutDashboard, roles: ["manajer", "kasir"] },
  { name: "Kasir (POS)", href: "/pos", icon: ShoppingCart, roles: ["manajer", "kasir"] },
  { name: "Manajemen Barang", href: "/products", icon: Package, roles: ["manajer"] },
  { name: "Terima Barang / PO", href: "/purchase-orders", icon: Truck, roles: ["manajer"] },
  { name: "Laporan Penjualan", href: "/reports", icon: BarChart3, roles: ["manajer"] },
  { name: "Retur Barang", href: "/returns", icon: RotateCcw, roles: ["manajer"] },
  { name: "Riwayat Transaksi", href: "/transactions", icon: History, roles: ["manajer", "kasir"] },
  { name: "Impor Data", href: "/import", icon: Upload, roles: ["manajer"] },
  { name: "Pengguna (Staf)", href: "/users", icon: Users, roles: ["manajer"] },
];

export function Sidebar({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { user } = useSession();
  const role = user?.role || "";
  const username = user?.username || "";
  
  // Handle responsive behavior
  useEffect(() => {
    setIsMounted(true);

    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    };
    
    // Initial check
    handleResize();
    
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [pathname]);

  // Check if we are on login page, if so don't render sidebar
  if (pathname === "/login") {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      console.error(e);
    }
    router.push("/login");
  };

  const visibleNavItems = navItems.filter(item => item.roles.includes(role));

  if (!isMounted) return null; // Avoid hydration mismatch

  return (
    <div className="flex h-screen bg-[#f6f8f4] overflow-hidden">
      {/* Mobile Backdrop */}
      {isMobile && isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } fixed md:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-sidebar-border flex flex-col transition-transform duration-300 ease-in-out shadow-sm`}
      >
        <div className="h-1 bg-brand-stripe shrink-0" />
        <div className="flex items-center justify-between h-20 px-4 border-b border-sidebar-border">
          <Link href="/" className="flex items-center" aria-label="LOGMART">
            <Logo size="sm" showTagline />
          </Link>
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
              <Menu className="w-5 h-5" />
            </Button>
          )}
        </div>

        <div className="mx-3 mt-3 p-3 flex items-center gap-3 rounded-xl bg-gradient-to-r from-brand-green/10 to-brand-orange-light/10 border border-brand-green/15">
          <div className="w-10 h-10 rounded-full bg-brand-gradient flex items-center justify-center text-white font-bold uppercase shadow-sm ring-2 ring-white">
            {username.charAt(0) || "U"}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold capitalize text-brand-ink truncate">{username || "User"}</div>
            <div className="inline-flex items-center gap-1 text-xs font-medium capitalize text-brand-orange">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-orange-gradient" />
              {role || "Role"}
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (pathname !== "/" && item.href !== "/" && pathname.startsWith(item.href));
            
            return (
              <Link 
                key={item.name} 
                href={item.href}
                onClick={() => isMobile && setIsOpen(false)}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? "bg-brand-green/10 text-brand-green font-semibold"
                    : "text-slate-600 hover:bg-brand-green/5 hover:text-brand-green"
                }`}
              >
                {isActive && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-brand-orange-gradient" />}
                <Icon className={`w-5 h-5 ${isActive ? "text-brand-green" : "text-slate-400"}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t">
          <Button variant="outline" className="w-full justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
            Keluar
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header (only shows on mobile) */}
        {isMobile && (
          <header className="relative h-16 bg-white border-b flex items-center px-4 shrink-0">
            <div className="absolute inset-x-0 top-0 h-1 bg-brand-stripe" />
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(true)} className="mr-2 text-brand-green">
              <Menu className="w-5 h-5" />
            </Button>
            <Logo size="sm" />
          </header>
        )}
        
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
