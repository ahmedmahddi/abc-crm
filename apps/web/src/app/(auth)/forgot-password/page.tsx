"use client";

import Link from "next/link";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { passwordResetRequestSchema, type PasswordResetRequestInput } from "@abc/shared";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";

type PasswordResetRequestResponse = { data: { ok: boolean; devResetToken?: string } };

export default function ForgotPasswordPage() {
  const [serverError, setServerError] = useState<string>();
  const [resetToken, setResetToken] = useState<string>();
  const [submitted, setSubmitted] = useState(false);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<PasswordResetRequestInput>({ resolver: zodResolver(passwordResetRequestSchema) });

  const submitRequest = handleSubmit(async (values) => {
    setServerError(undefined);
    setResetToken(undefined);
    try {
      const response = await apiFetch<PasswordResetRequestResponse>("/auth/password-reset/request", {
        method: "POST",
        body: JSON.stringify(values),
      });
      setSubmitted(true);
      setResetToken(response.data.devResetToken);
    } catch {
      setServerError("Impossible de preparer la reinitialisation pour le moment.");
    }
  });

  return (
    <AuthShell
      eyebrow="Recuperation"
      title="Reinitialiser le mot de passe"
      description="Indiquez votre email professionnel. Si le compte existe, un lien de reinitialisation sera prepare."
    >
      <form className="mt-8 flex flex-col gap-5" onSubmit={(event) => void submitRequest(event)}>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold" htmlFor="email">Email professionnel</label>
          <Input id="email" type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} {...register("email")} />
          {errors.email ? <p className="text-xs text-danger">Indiquez un email valide.</p> : null}
        </div>
        {submitted ? (
          <p className="rounded-md border border-success/30 bg-white px-3 py-2 text-sm text-success" role="status">
            Demande enregistree. Verifiez le canal de recuperation configure par l'administrateur.
          </p>
        ) : null}
        {resetToken ? (
          <p className="rounded-md border bg-white px-3 py-2 text-xs text-muted-foreground" role="status">
            Mode local: <Link className="font-semibold text-brand-700 hover:underline" href={`/reset-password?token=${encodeURIComponent(resetToken)}`}>ouvrir le lien de reinitialisation</Link>.
          </p>
        ) : null}
        {serverError ? <p className="rounded-md border border-danger/30 bg-white px-3 py-2 text-sm text-danger" role="alert">{serverError}</p> : null}
        <Button className="w-full" disabled={isSubmitting} type="submit">{isSubmitting ? "Verification..." : "Continuer"}</Button>
        <Button asChild className="w-full" variant="outline"><Link href="/login">Retour a la connexion</Link></Button>
      </form>
    </AuthShell>
  );
}
