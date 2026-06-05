"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { passwordResetConfirmSchema, type PasswordResetConfirmInput } from "@abc/shared";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [serverError, setServerError] = useState<string>();
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    watch,
  } = useForm<PasswordResetConfirmInput>({
    defaultValues: { token },
    resolver: zodResolver(passwordResetConfirmSchema),
  });
  const password = watch("password") ?? "";
  const strength = useMemo(() => getPasswordStrength(password), [password]);
  const submitReset = handleSubmit(async (values) => {
    setServerError(undefined);
    try {
      await apiFetch("/auth/password-reset/confirm", { method: "POST", body: JSON.stringify(values) });
      router.push("/login?reset=success");
    } catch {
      setServerError("Lien invalide, expire ou deja utilise.");
    }
  });

  return (
    <AuthShell
      eyebrow="Nouveau mot de passe"
      title="Finaliser la reinitialisation"
      description="Choisissez un mot de passe robuste. Les sessions existantes seront revoquees apres validation."
    >
      {!token ? (
        <div className="mt-8 rounded-md border border-danger/30 bg-white px-3 py-3 text-sm text-danger" role="alert">
          Lien de reinitialisation manquant. Demandez un nouveau lien.
        </div>
      ) : null}
      <form className="mt-8 flex flex-col gap-5" onSubmit={(event) => void submitReset(event)}>
        <input type="hidden" {...register("token")} />
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold" htmlFor="password">Nouveau mot de passe</label>
          <Input id="password" type="password" autoComplete="new-password" aria-invalid={Boolean(errors.password)} {...register("password")} />
          <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <span className={`block h-full ${strength.className}`} style={{ width: `${strength.percent}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">Force: {strength.label}. Minimum 10 caracteres.</p>
          {errors.password ? <p className="text-xs text-danger">Utilisez au moins 10 caracteres.</p> : null}
        </div>
        {serverError ? <p className="rounded-md border border-danger/30 bg-white px-3 py-2 text-sm text-danger" role="alert">{serverError}</p> : null}
        <Button className="w-full" disabled={isSubmitting || !token} type="submit">{isSubmitting ? "Mise a jour..." : "Mettre a jour"}</Button>
        <Button asChild className="w-full" variant="outline"><Link href="/login">Retour a la connexion</Link></Button>
      </form>
    </AuthShell>
  );
}

function getPasswordStrength(password: string) {
  const score = [
    password.length >= 10,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
  if (score <= 1) return { className: "bg-danger", label: "faible", percent: 25 };
  if (score === 2) return { className: "bg-warning", label: "correcte", percent: 50 };
  if (score === 3) return { className: "bg-brand-600", label: "bonne", percent: 75 };
  return { className: "bg-success", label: "forte", percent: 100 };
}
