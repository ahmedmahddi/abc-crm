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
const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password", "/session-expired", "/logged-out"];
const OPERATION_MANAGER_ROLES: UserRole[] = ["ADMIN", "RESPONSABLE"];

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isPending, setIsPending] = useState(!isPublicPath(pathname));

  useEffect(() => {
    let cancelled = false;
    if (isPublicPath(pathname)) {
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
  }, [pathname]);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST", redirectOnUnauthorized: false, retryOnUnauthorized: false });
    } catch {
      // Continue local logout even if the server session is already expired.
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
