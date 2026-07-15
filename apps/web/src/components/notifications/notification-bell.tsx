"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

type AppNotification = {
  id: string;
  title: string;
  body: string;
  entityType: string;
  entityId: string;
  readAt: string | null;
  createdAt: string;
};

type NotificationListResponse = { data: AppNotification[]; meta: { unreadCount: number } };

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiFetch<NotificationListResponse>("/notifications"),
    refetchInterval: 60_000,
  });
  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/notifications/${id}/read`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unreadCount = query.data?.meta.unreadCount ?? 0;
  const notifications = query.data?.data ?? [];

  return (
    <div className="relative">
      <Button
        aria-expanded={isOpen}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} non lues)` : ""}`}
        className="relative min-h-11"
        onClick={() => setIsOpen((current) => !current)}
        size="sm"
        type="button"
        variant="outline"
      >
        <Bell aria-hidden="true" className="size-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-danger text-[0.6rem] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </Button>
      {isOpen ? (
        <div className="absolute right-0 z-40 mt-2 w-80 rounded-md border bg-white shadow-lg" role="menu">
          <div className="border-b px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">Aucune notification</p>
            ) : (
              notifications.map((notification) => (
                <Link
                  className="block border-b px-4 py-3 text-sm hover:bg-brand-50/50"
                  href={notification.entityType === "AUDIT_EXTERNE" ? `/audit-externe/${notification.entityId}` : "/"}
                  key={notification.id}
                  onClick={() => {
                    setIsOpen(false);
                    if (!notification.readAt) markReadMutation.mutate(notification.id);
                  }}
                >
                  <p className={notification.readAt ? "font-medium text-muted-foreground" : "font-semibold"}>{notification.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{notification.body}</p>
                </Link>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
