"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { consultantColorPalette, consultantCreateSchema, type ConsultantColor, type ConsultantCreateInput } from "@abc/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiFetch, ApiError } from "@/lib/api";
import { enqueueOfflineMutation, isQueuedOfflineResult, shouldQueueOffline } from "@/lib/offline/outbox";
import type { QueuedOfflineResult } from "@/lib/offline/outbox";

export function ConsultantCreateForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useForm<z.input<typeof consultantCreateSchema>, unknown, ConsultantCreateInput>({
    defaultValues: {
      color: consultantColorPalette[0],
      email: "",
      fullName: "",
      phone: "",
      status: "ACTIVE",
    },
    resolver: zodResolver(consultantCreateSchema),
  });
  const mutation = useMutation({
    mutationFn: (input: ConsultantCreateInput): Promise<Record<string, unknown> | QueuedOfflineResult> => {
      if (shouldQueueOffline()) {
        return enqueueOfflineMutation({ entityType: "CONSULTANT", operation: "CREATE", payload: input });
      }

      return apiFetch<Record<string, unknown>>("/consultants", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["consultants"] });
      router.push(isQueuedOfflineResult(result) ? "/sync?queued=consultant" : "/consultants");
    },
  });
  const submit = form.handleSubmit((values) => mutation.mutate(values));

  return (
    <form className="flex flex-col gap-5" onSubmit={(event) => void submit(event)}>
      <Card>
        <CardHeader>
          <CardTitle>Profil consultant</CardTitle>
          <CardDescription>Coordonnees utilisees pour les affectations clients et missions.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field data-invalid={Boolean(form.formState.errors.fullName)}>
              <FieldLabel htmlFor="fullName">Nom complet</FieldLabel>
              <Input id="fullName" aria-invalid={Boolean(form.formState.errors.fullName)} {...form.register("fullName")} />
              {form.formState.errors.fullName ? <FieldError>Indiquez le nom complet.</FieldError> : null}
            </Field>
            <Field data-invalid={Boolean(form.formState.errors.email)}>
              <FieldLabel htmlFor="email">Email professionnel</FieldLabel>
              <Input id="email" type="email" aria-invalid={Boolean(form.formState.errors.email)} {...form.register("email")} />
              {form.formState.errors.email ? <FieldError>Indiquez un email valide.</FieldError> : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="phone">Telephone</FieldLabel>
              <Input id="phone" type="tel" {...form.register("phone")} />
            </Field>
            <ConsultantColorField
              value={form.watch("color") ?? consultantColorPalette[0]}
              onChange={(color) => form.setValue("color", color, { shouldDirty: true, shouldValidate: true })}
            />
          </FieldGroup>
        </CardContent>
      </Card>
      {mutation.isError ? (
        <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">
          {mutation.error instanceof ApiError ? mutation.error.message : "Impossible de creer le consultant."}
        </p>
      ) : null}
      <div className="sticky bottom-16 z-20 flex justify-end gap-3 rounded-lg border bg-white/95 p-3 shadow-md backdrop-blur lg:bottom-0">
        <Button asChild variant="outline">
          <Link href="/consultants">Annuler</Link>
        </Button>
        <Button disabled={mutation.isPending} type="submit">
          {mutation.isPending ? "Creation..." : "Creer le consultant"}
        </Button>
      </div>
    </form>
  );
}

function ConsultantColorField({ value, onChange }: Readonly<{ value: ConsultantColor; onChange: (color: ConsultantColor) => void }>) {
  return (
    <Field>
      <FieldLabel>Couleur calendrier</FieldLabel>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {consultantColorPalette.map((color) => (
          <button
            aria-label={`Choisir la couleur consultant ${color}`}
            aria-pressed={value === color}
            className={`min-h-11 rounded-md border bg-white p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${value === color ? "border-brand-500" : "border-border"}`}
            key={color}
            onClick={() => onChange(color)}
            type="button"
          >
            <span className="block h-7 rounded" style={{ backgroundColor: color }} />
          </button>
        ))}
      </div>
    </Field>
  );
}
