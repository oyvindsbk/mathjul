'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/api/auth/callback', '/.auth', '/api/auth/token', '/api/auth/fake-callback'];

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    // Don't check while loading
    if (isLoading) {
      return;
    }

    // Check if route is public
    const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

    // If not authenticated and not a public route, redirect to login
    if (!isAuthenticated && !isPublicRoute && !pathname.startsWith('/_next') && !pathname.startsWith('/public')) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, pathname, router]);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // If not authenticated and not public route, don't render
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
  if (!isAuthenticated && !isPublicRoute) {
    return null;
  }

  return <>{children}</>;
}
