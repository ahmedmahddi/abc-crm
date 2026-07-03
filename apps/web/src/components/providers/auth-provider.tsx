"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { UserRole } from "@abc/shared";
import { apiFetch } from "@/lib/api";

type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  sessionId: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  isPending: boolean;
  canManageOperations: boolean;
  canManageUsers: boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password", "/session-expired", "/logged-out", "/restore-access"];
const OPERATION_MANAGER_ROLES: UserRole[] = ["ADMIN", "RESPONSABLE"];

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const publicPath = isPublicPath(pathname);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isPending, setIsPending] = useState(!publicPath);

  useEffect(() => {
    let cancelled = false;
    if (publicPath) {
      setUser(null);
      setIsPending(false);
      return;
    }

    setIsPending(true);
    apiFetch<{ data: { user: AuthUser } }>("/auth/me", {
      redirectOnUnauthorized: false,
      retryOnUnauthorized: true,
    })
      .then((response) => {
        if (!cancelled) setUser(response.data.user);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setIsPending(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, publicPath]);

  useEffect(() => {
    if (publicPath || isPending || user) return;
    router.replace("/login");
  }, [isPending, publicPath, router, user]);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST", redirectOnUnauthorized: false, retryOnUnauthorized: false });
    } catch {
      // Local logout continues even when the API session is already closed.
    } finally {
      setUser(null);
      router.replace("/login?loggedOut=true");
    }
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isPending,
      canManageOperations: Boolean(user && OPERATION_MANAGER_ROLES.includes(user.role)),
      canManageUsers: user?.role === "ADMIN",
      logout,
    }),
    [isPending, logout, user],
  );

  if (!publicPath && (isPending || !user)) {
    return <AuthContext.Provider value={value}><SessionGate /></AuthContext.Provider>;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

function SessionGate() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
      <div className="max-w-sm rounded-xl border bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-brand-700">ABC CRM</p>
        <p className="mt-3 text-sm text-muted-foreground">Verification de la session...</p>
      </div>
    </main>
  );
}

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
