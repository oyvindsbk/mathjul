import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { AuthProvider } from "@/lib/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { NavigationProgress } from "@/components/NavigationProgress";
import { appConfig } from "@/lib/config";
import { BugReporter } from "@/components/BugReporter";
import { BreadcrumbBar } from "@/components/BreadcrumbBar";
import { BottomNav } from "@/components/BottomNav";
import { UpdatePrompt } from "@/components/UpdatePrompt";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export const metadata: Metadata = {
  title: "Matoppskrifter",
  description: "Oppdag og utforsk oppskrifter",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Matjul",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="no">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <NavigationProgress />
          <ProtectedRoute>
            <div className="flex flex-col w-full">
              {appConfig.mocking.enabled && (
                <div className="w-full bg-red-600 text-white text-center py-4 px-6">
                  <strong className="text-xl">DEVELOPMENT MODE — USING MOCK DATA</strong>
                  <div className="text-sm">The app is currently serving mock data only. Real backend is not used.</div>
                </div>
              )}

              <Sidebar />
              <BreadcrumbBar />
              <main className="pb-16 md:pb-0">
                {children}
              </main>
              <BottomNav />
            </div>
          </ProtectedRoute>
          <BugReporter />
          <UpdatePrompt />
        </AuthProvider>
      </body>
    </html>
  );
}
