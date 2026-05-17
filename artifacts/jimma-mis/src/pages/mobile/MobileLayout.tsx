import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { useOfflineDB } from "@/hooks/use-offline-db";
import {
  PlusCircle,
  FolderOpen,
  CheckCircle2,
  XCircle,
  RefreshCw,
  LogOut,
  Wifi,
  WifiOff,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileLayoutProps {
  children: React.ReactNode;
}

export function MobileLayout({ children }: MobileLayoutProps) {
  const { user, isLoading, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { isOnline } = useNetworkStatus();
  const { unsyncedDrafts } = useOfflineDB();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-svh bg-blue-900">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const nav = [
    { href: "/mobile/field-collection", label: "New", icon: PlusCircle },
    { href: "/mobile/offline-drafts", label: "Drafts", icon: FolderOpen, badge: unsyncedDrafts.length },
    { href: "/mobile/synced", label: "Synced", icon: CheckCircle2 },
    { href: "/mobile/rejected", label: "Rejected", icon: XCircle },
  ];

  return (
    <div className="flex flex-col min-h-svh bg-slate-50">
      {/* Top bar */}
      <header className="bg-blue-900 text-white px-4 pt-safe-top sticky top-0 z-40 shadow-md">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <span className="font-bold text-base leading-tight">Jimma MIS</span>
            <span className="text-blue-300 text-xs hidden sm:block">Field Collection</span>
          </div>
          <div className="flex items-center gap-3">
            {isOnline ? (
              <span className="flex items-center gap-1 text-xs text-emerald-300 font-medium">
                <Wifi className="w-3.5 h-3.5" />
                Online
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-amber-300 font-medium">
                <WifiOff className="w-3.5 h-3.5" />
                Offline
              </span>
            )}
            {unsyncedDrafts.length > 0 && isOnline && (
              <Link href="/mobile/offline-drafts">
                <button className="flex items-center gap-1 text-xs bg-amber-500 text-white px-2 py-1 rounded-full font-medium">
                  <RefreshCw className="w-3 h-3" />
                  {unsyncedDrafts.length} pending
                </button>
              </Link>
            )}
            <button
              onClick={logout}
              className="p-1.5 rounded-full hover:bg-blue-800 active:bg-blue-700 transition-colors"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4 text-blue-200" />
            </button>
          </div>
        </div>
      </header>

      {/* Offline banner */}
      {!isOnline && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center gap-2 text-amber-800 text-sm font-medium">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>
            Offline Mode — You can save drafts. They will sync when you reconnect.
          </span>
        </div>
      )}

      {/* User context */}
      <div className="bg-white border-b px-4 py-2 text-xs text-slate-500">
        Signed in as <span className="font-semibold text-slate-700">{user.fullName}</span>
        <span className="ml-2 text-slate-400">({user.role.replace("_", " ")})</span>
      </div>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 safe-bottom z-40 shadow-lg">
        <div className="grid grid-cols-4 h-16">
          {nav.map(({ href, label, icon: Icon, badge }) => {
            const active = location === href || location.startsWith(href + "?");
            return (
              <Link key={href} href={href}>
                <button
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 w-full h-full relative transition-colors",
                    active
                      ? "text-blue-700"
                      : "text-slate-500 active:text-blue-600",
                  )}
                >
                  <div className="relative">
                    <Icon className={cn("w-5 h-5", active && "fill-blue-100")} />
                    {badge != null && badge > 0 && (
                      <span className="absolute -top-1.5 -right-2 bg-amber-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                        {badge > 9 ? "9+" : badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-medium leading-none">{label}</span>
                  {active && (
                    <span className="absolute top-0 inset-x-0 h-0.5 bg-blue-700 rounded-b" />
                  )}
                </button>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
