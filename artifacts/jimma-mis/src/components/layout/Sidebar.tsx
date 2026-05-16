import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  LayoutDashboard,
  Map,
  FileText,
  Users,
  Building2,
  LogOut,
  MapPin,
  Navigation,
  Grid3x3,
  Settings2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [setupOpen, setSetupOpen] = useState(location.startsWith("/setup"));

  const isSetupRole = user?.role === "admin" || user?.role === "city_officer" || user?.role === "kebele_officer" || user?.role === "viewer";

  const mainNav = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/properties", label: "Properties", icon: Building2 },
    { href: "/map", label: "Map View", icon: Map },
    { href: "/reports", label: "Reports", icon: FileText },
  ];

  const setupNav = [
    { href: "/setup/locations", label: "Kebeles", icon: MapPin },
    { href: "/setup/streets", label: "Streets", icon: Navigation },
    { href: "/setup/blocks", label: "Blocks", icon: Grid3x3 },
  ];

  function NavLink({ href, label, icon: Icon, indent = false }: { href: string; label: string; icon: React.ElementType; indent?: boolean }) {
    const isActive = location === href || location.startsWith(`${href}/`);
    return (
      <Link href={href}>
        <div className={cn(
          "flex items-center gap-3 rounded-md transition-colors cursor-pointer text-sm font-medium",
          indent ? "px-6 py-2" : "px-3 py-2.5",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        )}>
          <Icon className="h-4 w-4 shrink-0" />
          {label}
        </div>
      </Link>
    );
  }

  return (
    <div className="hidden md:flex print:hidden w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border shadow-sm z-10 relative">
      <div className="flex items-center h-16 px-6 border-b border-sidebar-border bg-sidebar shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold">J</div>
          <span className="font-semibold tracking-tight text-lg">Jimma MIS</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1">
        {mainNav.map((item) => <NavLink key={item.href} {...item} />)}

        {(user?.role === "admin" || user?.role === "city_officer") && (
          <NavLink href="/users" label="Users" icon={Users} />
        )}

        {isSetupRole && (
          <div className="mt-2">
            <button
              onClick={() => setSetupOpen((v) => !v)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors cursor-pointer text-sm font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground"
            >
              <Settings2 className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">Setup</span>
              {setupOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
            {setupOpen && (
              <div className="mt-0.5 flex flex-col gap-0.5">
                {setupNav.map((item) => <NavLink key={item.href} {...item} indent />)}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-sidebar-border">
        <div className="mb-2 px-3 py-1.5">
          <p className="text-xs font-medium text-sidebar-foreground/70 truncate">{user?.fullName ?? user?.username}</p>
          <p className="text-[11px] text-sidebar-foreground/50 capitalize">{user?.role?.replace("_", " ")}</p>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 px-3"
          onClick={logout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
