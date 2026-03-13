import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { AuthProvider } from "@/lib/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { appConfig } from "@/lib/config";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Matoppskrifter",
  description: "Oppdag og utforsk oppskrifter",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="no">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <ProtectedRoute>
            <div className="flex flex-col w-full">
              {appConfig.mocking.enabled && (
                <div className="w-full bg-red-600 text-white text-center py-4 px-6">
                  <strong className="text-xl">DEVELOPMENT MODE — USING MOCK DATA</strong>
                  <div className="text-sm">The app is currently serving mock data only. Real backend is not used.</div>
                </div>
              )}

              <div className="flex">
                <Sidebar />
                <main className="flex-1">
                  {children}
                </main>
              </div>
            </div>
          </ProtectedRoute>
        </AuthProvider>
      </body>
    </html>
  );
}
