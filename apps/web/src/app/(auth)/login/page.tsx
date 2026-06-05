"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { loginSchema, type LoginInput } from "@abc/shared";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [serverError, setServerError] = useState<string>();
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });
  const submitLogin = handleSubmit(async (values) => {
    setServerError(undefined);
    try {
      await apiFetch("/auth/login", { method: "POST", body: JSON.stringify(values) });
      router.push("/");
      router.refresh();
    } catch {
      setServerError("Connexion impossible. Verifiez votre email et votre mot de passe.");
    }
  });

  return (
    <AuthShell
      eyebrow="Connexion securisee"
      title="Acceder a ABC CRM"
      description="Utilisez votre compte professionnel pour acceder a votre espace de travail."
    >
      {searchParams.get("reset") === "success" ? (
        <p className="mt-6 rounded-md border border-success/30 bg-white px-3 py-2 text-sm text-success" role="status">
          Mot de passe mis a jour. Vous pouvez vous reconnecter.
        </p>
      ) : null}
      {searchParams.get("loggedOut") === "true" ? (
        <p className="mt-6 rounded-md border bg-white px-3 py-2 text-sm text-muted-foreground" role="status">
          Session fermee correctement.
        </p>
      ) : null}
      <form className="mt-8 flex flex-col gap-5" onSubmit={(event) => void submitLogin(event)}>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold" htmlFor="email">Email professionnel</label>
          <Input id="email" type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} {...register("email")} />
          {errors.email ? <p className="text-xs text-danger">{errors.email.message}</p> : null}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-semibold" htmlFor="password">Mot de passe</label>
            <Link className="text-xs font-semibold text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" href="/forgot-password">
              Mot de passe oublie
            </Link>
          </div>
          <Input id="password" type="password" autoComplete="current-password" aria-invalid={Boolean(errors.password)} {...register("password")} />
          {errors.password ? <p className="text-xs text-danger">Le mot de passe doit contenir au moins 8 caracteres.</p> : null}
        </div>
        {serverError ? <p className="rounded-md border border-danger/30 bg-white px-3 py-2 text-sm text-danger" role="alert">{serverError}</p> : null}
        <Button className="w-full" disabled={isSubmitting} type="submit">{isSubmitting ? "Connexion en cours..." : "Se connecter"}</Button>
      </form>
    </AuthShell>
  );
}
