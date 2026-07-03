"use client";

import { useEffect, useState } from "react";

export default function RestoreAccessPage() {
  const [message, setMessage] = useState("Preparation de la reconnexion...");

  useEffect(() => {
    async function run() {
      setMessage("Nettoyage de l'application locale...");
      window.sessionStorage.clear();
      window.localStorage.removeItem("abc.cleanup.v1");
      document.cookie = "csrf_token=; Max-Age=0; path=/";

      if ("caches" in window) {
        const keys = await window.caches.keys();
        await Promise.all(keys.map((key) => window.caches.delete(key)));
      }

      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }

      setMessage("Redirection vers la connexion...");
      window.location.replace(`/login?restored=true&t=${Date.now()}`);
    }

    void run().catch(() => {
      window.location.replace(`/login?restored=partial&t=${Date.now()}`);
    });
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
      <div className="max-w-sm rounded-xl border bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-brand-700">ABC CRM</p>
        <h1 className="mt-2 font-display text-2xl font-semibold">Restauration de l'acces</h1>
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
      </div>
    </main>
  );
}
