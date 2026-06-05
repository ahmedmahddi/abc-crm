import { Suspense } from "react";
import { CalendarWorkspace } from "@/components/calendar/calendar-workspace";
import { AppShell } from "@/components/layout/app-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function CalendarPage() {
  return <AppShell><Suspense fallback={<Skeleton className="h-[42rem] border" />}><CalendarWorkspace /></Suspense></AppShell>;
}
