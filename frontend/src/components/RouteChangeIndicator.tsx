'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export function RouteChangeIndicator() {
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(false);

  // Reset loading state when pathname changes (navigation completed)
  useEffect(() => {
    setIsLoading(false);
  }, [pathname]);

  // Listen for navigation attempts
  useEffect(() => {
    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a[href]') as HTMLAnchorElement | null;
      
      if (link && link.href && !link.target && !link.hasAttribute('download')) {
        const href = link.getAttribute('href');
        // Only show loading for internal navigation
        if (href && !href.startsWith('http') && !href.startsWith('//') && !href.startsWith('#')) {
          setIsLoading(true);
        }
      }
    };

    document.addEventListener('click', handleLinkClick, true);

    return () => {
      document.removeEventListener('click', handleLinkClick, true);
    };
  }, []);

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center pointer-events-none z-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-700 font-medium">Laster inn...</p>
      </div>
    </div>
  );
}
