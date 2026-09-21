import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, isLoading, token } = useAuth();
  const [location, setLocation] = useLocation();

  const hasToken = Boolean(token || (typeof window !== "undefined" && localStorage.getItem("jimma_token")));

  useEffect(() => {
    if (!isLoading && !user && !hasToken && location !== "/login") {
      setLocation("/login");
    }
  }, [user, isLoading, hasToken, location, setLocation]);

  if (isLoading || (hasToken && !user)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user && location !== "/login") {
    return null; // Will redirect in effect
  }

  if (!user) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/50">
          {children}
        </main>
      </div>
    </div>
  );
}
