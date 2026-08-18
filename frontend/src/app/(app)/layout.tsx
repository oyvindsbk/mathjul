import { Sidebar } from "@/components/Sidebar";
import { AuthProvider } from "@/lib/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { NavigationProgress } from "@/components/NavigationProgress";
import { appConfig } from "@/lib/config";
import { BugReporter } from "@/components/BugReporter";
import { BreadcrumbBar } from "@/components/BreadcrumbBar";
import { BottomNav } from "@/components/BottomNav";
import { UpdatePrompt } from "@/components/UpdatePrompt";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
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
  );
}
