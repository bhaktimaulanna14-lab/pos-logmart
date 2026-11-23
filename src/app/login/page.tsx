/* eslint-disable */
// @ts-nocheck
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Store, User, Lock, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Logo } from "@/components/brand/Logo";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        if (data.data.role === "manajer") {
          router.push("/");
        } else {
          router.push("/pos");
        }
      } else {
        setError(data.message || "Username atau password salah");
      }
    } catch (error) {
      console.error("Login error:", error);
      setError("Terjadi kesalahan jaringan.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#f1f8e9] via-white to-[#fff3e6] flex items-center justify-center p-4">
      <div aria-hidden className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full bg-brand-green-light/30 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-brand-orange-light/25 blur-3xl" />
      <div className="relative max-w-md w-full space-y-8">
        <div className="text-center">
          <Logo size="lg" showTagline className="mb-6" />
          <h2 className="font-brand text-xl font-bold tracking-tight text-brand-ink">
            Logmart POS
          </h2>
          <p className="text-slate-500 mt-1">
            Silakan masuk ke akun Anda
          </p>
        </div>

        <Card className="border-0 shadow-xl shadow-brand-green/10 ring-1 ring-black/5 overflow-hidden pt-0">
          <div className="h-1.5 bg-brand-stripe" />
          <form onSubmit={handleLogin}>
            <CardHeader>
              <CardTitle>Masuk</CardTitle>
              <CardDescription>
                Masukkan kredensial Anda untuk mengakses sistem.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive" className="py-2 px-3">
                  <AlertDescription className="text-sm">{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    id="username"
                    type="text" 
                    placeholder="admin atau kasir1"
                    autoComplete="username"
                    className="pl-9"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    id="password"
                    type="password" 
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="pl-9"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full gap-2 h-10 bg-brand-gradient hover:brightness-105 shadow-md shadow-brand-green/25 font-semibold" disabled={isLoading}>
                {isLoading ? "Memproses..." : (
                  <>
                    <LogIn className="w-4 h-4" /> Masuk Sistem
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
        
        <p className="text-center text-xs text-slate-500">
          &copy; {new Date().getFullYear()} Logmart Trowono. Hak cipta dilindungi.
        </p>
      </div>
    </div>
  );
}
