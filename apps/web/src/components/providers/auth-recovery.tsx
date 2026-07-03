"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function AuthRecovery() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/session-expired") return;
    window.location.href = "/login";
  }, [pathname]);

  return null;
}
