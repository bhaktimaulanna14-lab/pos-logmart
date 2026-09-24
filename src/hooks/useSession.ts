import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export type SessionUser = {
  id: string;
  name: string;
  username: string;
  role: string;
};

export function useSession({ requiredRole }: { requiredRole?: string } = {}) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Avoid running on login page to prevent infinite redirects if something goes wrong
    if (pathname === '/login') {
      const timer = setTimeout(() => setLoading(false), 0);
      return () => clearTimeout(timer);
    }

    let isMounted = true;

    fetch('/api/auth/me')
      .then(res => res.json())
      .then(json => {
        if (!isMounted) return;

        if (json.success && json.data) {
          if (requiredRole && json.data.role !== requiredRole) {
            router.push('/');
          } else {
            setUser(json.data);
          }
        } else {
          router.push('/login');
        }
      })
      .catch(() => {
        if (!isMounted) return;
        router.push('/login');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [router, pathname, requiredRole]);

  return { user, loading };
}
