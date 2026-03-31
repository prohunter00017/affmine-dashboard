/**
 * Root layout component.
 *
 * Renders the sidebar navigation with links to all pages and embeds the
 * {@link CredentialsBanner} at the top of the main content area.
 */

import { Link, useLocation } from "wouter";
import { Activity, LayoutDashboard, List, Settings, TrendingUp } from "lucide-react";
import { CredentialsBanner } from "./credentials-banner";
import { useFavorites } from "@/hooks/use-favorites";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { count: favCount } = useFavorites();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/campaigns", label: "Campaign Browser", icon: List, badge: favCount > 0 ? favCount : undefined },
    { href: "/stats", label: "Analytics", icon: TrendingUp },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="flex min-h-screen w-full bg-background flex-col md:flex-row">
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border bg-sidebar flex-shrink-0">
        <div className="flex h-16 items-center px-6 border-b border-border">
          <Activity className="h-6 w-6 text-primary mr-3" />
          <span className="font-mono font-bold tracking-tight text-sidebar-foreground">
            AffMine<span className="text-primary">Terminal</span>
          </span>
        </div>
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                  data-testid={`nav-link-${item.label.toLowerCase().replace(" ", "-")}`}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="ml-auto text-[10px] font-mono font-bold bg-yellow-400/15 text-yellow-400 border border-yellow-400/30 px-1.5 py-0.5 rounded-full leading-none">
                      {item.badge}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <CredentialsBanner />
        <div className="flex-1 overflow-auto">
          <div className="p-6 md:p-8 max-w-7xl mx-auto w-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
