"use client";

import { useEffect, useMemo, useState } from "react";
import { resetClientSession } from "@/lib/api";
import { buttonVariants } from "@/components/ui/button";

export function SessionResetClient() {
  const [showManualAction, setShowManualAction] = useState(false);
  const loginHref = useMemo(() => `/login?reason=session-expired&t=${Date.now()}`, []);

  useEffect(() => {
    let isMounted = true;

    resetClientSession()
      .finally(() => {
        if (!isMounted) return;
        setShowManualAction(true);
        window.location.replace(loginHref);
      });

    const fallbackTimer = window.setTimeout(() => {
      if (isMounted) setShowManualAction(true);
    }, 2000);

    return () => {
      isMounted = false;
      window.clearTimeout(fallbackTimer);
    };
  }, [loginHref]);

  const reconnect = () => {
    void resetClientSession().finally(() => {
      window.location.href = loginHref;
    });
  };

  return (
    <div className="mt-8 flex flex-col gap-3">
      <p className="rounded-md border border-warning/30 bg-white px-3 py-3 text-sm text-muted-foreground" role="status">
        Reinitialisation de la session locale en cours. Vous allez etre redirige automatiquement vers la connexion.
      </p>
      {showManualAction ? (
        <button className={buttonVariants({ className: "w-full" })} onClick={reconnect} type="button">
          Se reconnecter maintenant
        </button>
      ) : null}
    </div>
  );
}
