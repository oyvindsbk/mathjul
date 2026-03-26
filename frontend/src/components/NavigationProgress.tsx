'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

export function NavigationProgress() {
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);
  // Track the pathname at click time to detect when navigation actually completes
  const clickedPathname = useRef<string | null>(null);

  useEffect(() => {
    const handleLinkClick = (e: MouseEvent) => {
      // Only trigger for anchor elements navigating to a different path
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href === pathname || href.startsWith('http') || href.startsWith('mailto')) return;
      clickedPathname.current = pathname;
      setIsNavigating(true);
    };

    document.addEventListener('click', handleLinkClick, true);
    return () => {
      document.removeEventListener('click', handleLinkClick, true);
    };
  }, [pathname]);

  // Hide when pathname actually changes (navigation completed)
  useEffect(() => {
    if (clickedPathname.current !== null && clickedPathname.current !== pathname) {
      clickedPathname.current = null;
      setIsNavigating(false);
    }
  }, [pathname]);

  if (!isNavigating) return null;

  return (
    <div className="fixed top-0 left-0 right-0 h-1 bg-blue-600 z-50 animate-pulse" />
  );
}
