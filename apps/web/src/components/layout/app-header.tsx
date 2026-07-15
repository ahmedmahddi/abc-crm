"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useAuth } from "@/components/providers/auth-provider";

export function AppHeader() {
  const { isPending, logout, user } = useAuth();

  return (
    <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:h-16">
      <div className="lg:hidden">
        <p className="font-display text-base font-semibold text-brand-700">
          ABC <span className="font-normal text-foreground">CRM</span>
        </p>
      </div>
      <div className="ml-auto flex min-w-0 items-center gap-3">
        {user ? (
          <div className="hidden min-w-0 text-right sm:block">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.role}</p>
          </div>
        ) : isPending ? (
          <p className="text-xs text-muted-foreground">Session...</p>
        ) : null}
        {user ? <NotificationBell /> : null}
        {user ? (
          <Button
            aria-label="Se deconnecter"
            className="min-h-11"
            size="sm"
            type="button"
            variant="outline"
            onClick={() => void logout()}
          >
            <LogOut aria-hidden="true" className="size-4 sm:mr-2" />
            <span className="hidden sm:inline">Sortir</span>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
