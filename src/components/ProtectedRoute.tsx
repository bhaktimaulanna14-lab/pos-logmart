"use client";

import { useSession } from '@/hooks/useSession';
import { ReactNode } from 'react';

export function ProtectedRoute({ 
  children, 
  requiredRole 
}: { 
  children: ReactNode; 
  requiredRole?: string;
}) {
  const { user, loading } = useSession({ requiredRole });

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null; // The hook will redirect to /login
  }

  return <>{children}</>;
}
