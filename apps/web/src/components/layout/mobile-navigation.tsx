"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, CircleEllipsis, House, UsersRound } from "lucide-react";
import { cn } from "@/lib/cn";

const mobileItems = [
  { href: "/", label: "Accueil", icon: House },
  { href: "/calendar", label: "Calendrier", icon: CalendarDays },
  { href: "/clients", label: "Clients", icon: UsersRound },
  { href: "/more", label: "Plus", icon: CircleEllipsis },
];

export function MobileNavigation() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation mobile" className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 shadow-lg backdrop-blur lg:hidden">
      <div className="grid grid-cols-4">
        {mobileItems.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[0.68rem] font-semibold text-abcNeutral-600 transition-colors duration-normal ease-abc-out hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none",
                active && "bg-brand-50/70 text-brand-700",
              )}
              href={item.href}
              key={item.label}
            >
              <item.icon aria-hidden="true" className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
