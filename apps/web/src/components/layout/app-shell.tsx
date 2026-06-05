import { Suspense } from "react";
import { Sidebar } from "./sidebar";
import { MobileNavigation } from "./mobile-navigation";

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar />
      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 border-b bg-white/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/90">
          {/* <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:h-16">
            <div className="lg:hidden"><LogoMark /></div>
            <div className="ml-auto"><SyncStatus /></div>
          </div> */}
        </header>
        <main className="px-4 py-4 pb-24 sm:px-6 lg:px-6 lg:py-6 lg:pb-6">{children}</main>
      </div>
      <Suspense fallback={null}><MobileNavigation /></Suspense>
    </div>
  );
}
