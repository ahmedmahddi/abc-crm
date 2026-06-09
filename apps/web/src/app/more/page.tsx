"use client";

import Link from "next/link";
import { RefreshCw, UserCog, UserRoundCog } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, PagePanel, PageStack } from "@/components/layout/page-section";
import { PushNotificationSettings } from "@/components/notifications/push-notification-settings";
import { useAuth } from "@/components/providers/auth-provider";

const sections = [
  { href: "/consultants", label: "Consultants", description: "Affectations et comptes lies", icon: UserRoundCog },
  { href: "/users", label: "Utilisateurs", description: "Comptes, roles et sessions", icon: UserCog },
  { href: "/sync", label: "Synchronisation", description: "File d'attente et conflits hors ligne", icon: RefreshCw },
];

export default function MorePage() {
  const { canManageUsers } = useAuth();
  const visibleSections = sections.filter((section) => section.href !== "/users" || canManageUsers);

  return (
    <AppShell>
      <PageStack>
        <PageHeader
          eyebrow="Navigation mobile"
          title="Plus"
          description="Accedez aux outils operationnels complementaires sans creer une application separee."
        />
        <PagePanel as="section" className="grid gap-2 sm:grid-cols-2" aria-label="Gestion du bureau d'etude">
          {visibleSections.map((section) => (
            <Link className="group flex min-h-20 items-center gap-3 rounded-md border bg-white p-3 shadow-soft transition-colors hover:border-brand-200 hover:bg-brand-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={section.href} key={section.href}>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700 transition-colors group-hover:bg-white">
                <section.icon aria-hidden="true" className="size-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold">{section.label}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{section.description}</span>
              </span>
            </Link>
          ))}
        </PagePanel>
        <PushNotificationSettings />
      </PageStack>
    </AppShell>
  );
}
