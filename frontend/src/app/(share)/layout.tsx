import type { Metadata } from "next";

/**
 * Chrome-free layout for the public share page. It inherits fonts and global CSS
 * from the root layout but deliberately adds nothing else: no AuthProvider, no
 * ProtectedRoute, no sidebar, breadcrumb, or bottom nav — a recipient holding a
 * link gets one recipe and no way into the rest of the app.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ShareLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
