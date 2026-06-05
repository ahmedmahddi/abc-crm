"use client";

import type { ReactNode } from "react";
import type { UserRole } from "@abc/shared";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/providers/auth-provider";

export function RoleGate({
  allowedRoles,
  children,
  fallback = null,
}: Readonly<{ allowedRoles: UserRole[]; children: ReactNode; fallback?: ReactNode }>) {
  const { isPending, user } = useAuth();
  if (isPending) return null;
  if (!user || !allowedRoles.includes(user.role)) return fallback;
  return children;
}

export function ProtectedRoute({
  allowedRoles,
  children,
}: Readonly<{ allowedRoles: UserRole[]; children: ReactNode }>) {
  const { isPending, user } = useAuth();
  if (isPending) return <Skeleton className="h-72 border" />;
  if (!user || !allowedRoles.includes(user.role)) {
    return (
      <section className="rounded-lg border bg-white p-6" aria-labelledby="forbidden-title">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acces refuse</p>
        <h1 id="forbidden-title" className="mt-2 text-xl font-semibold text-foreground">
          Vous n'avez pas les droits pour cette page.
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Demandez a un administrateur ABC CRM d'ajuster votre role si cette action fait partie de votre travail.
        </p>
        <Button className="mt-5" asChild variant="outline">
          <a href="/">Retour a l'accueil</a>
        </Button>
      </section>
    );
  }
  return children;
}
