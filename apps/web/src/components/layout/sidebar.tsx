"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, House, RefreshCw, UserCog, UserRoundCog, Users } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { cn } from "@/lib/cn";

const planningItems = [
  { href: "/", label: "Accueil", icon: House },
  { href: "/calendar", label: "Calendrier", icon: CalendarDays },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/consultants", label: "Consultants", icon: UserRoundCog },
];

const administrationItems = [
  { href: "/users", label: "Utilisateurs", icon: UserCog },
  { href: "/sync", label: "Synchronisation", icon: RefreshCw },
];

export function Sidebar() {
  const { canManageUsers } = useAuth();
  const visibleAdministrationItems = administrationItems.filter((item) => item.href !== "/users" || canManageUsers);

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-60 border-r bg-white shadow-sm lg:flex lg:flex-col">
      <div className="flex h-16 items-center border-b px-4">
        <div>
          <p className="font-display text-lg font-semibold text-brand-700">ABC <span className="font-normal text-foreground">CRM</span></p>
          <p className="text-xs text-muted-foreground">Bureau d'etude</p>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4" aria-label="Navigation principale">
        <NavigationGroup items={planningItems} />
        <NavigationGroup items={visibleAdministrationItems} label="Gestion" />
      </nav>
    </aside>
  );
}

function NavigationGroup({ items, label }: Readonly<{ items: typeof planningItems; label?: string }>) {
  const pathname = usePathname();
  return (
    <div className="flex flex-col gap-1">
      {label ? <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p> : null}
      {items.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-r-md border-l-[3px] border-transparent px-3 text-sm font-semibold text-abcNeutral-700 transition-colors duration-normal ease-abc-out hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none",
              active && "border-brand-500 bg-brand-50 text-brand-700",
            )}
            href={item.href}
            key={item.href}
          >
            <item.icon aria-hidden="true" className="size-4" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
