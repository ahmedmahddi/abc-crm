"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { consultantColorPalette, consultantUpdateSchema, type ConsultantColor, type ConsultantUpdateInput } from "@abc/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiFetch, ApiError } from "@/lib/api";
import { enqueueOfflineMutation, isQueuedOfflineResult, shouldQueueOffline } from "@/lib/offline/outbox";
import type { QueuedOfflineResult } from "@/lib/offline/outbox";

type Consultant = {
  id: string;
  color?: ConsultantColor;
  fullName: string;
  email: string;
  phone?: string;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  version: number;
};

export function ConsultantEditForm({ consultant }: Readonly<{ consultant: Consultant }>) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useForm<z.input<typeof consultantUpdateSchema>, unknown, ConsultantUpdateInput>({
    defaultValues: {
      color: consultant.color ?? consultantColorPalette[0],
      email: consultant.email,
      fullName: consultant.fullName,
      phone: consultant.phone ?? "",
      status: consultant.status,
      version: consultant.version,
    },
    resolver: zodResolver(consultantUpdateSchema),
  });
  const mutation = useMutation({
    mutationFn: (input: ConsultantUpdateInput): Promise<Record<string, unknown> | QueuedOfflineResult> => {
      if (shouldQueueOffline()) {
        return enqueueOfflineMutation({
          baseVersion: consultant.version,
          entityId: consultant.id,
          entityType: "CONSULTANT",
          operation: "UPDATE",
          payload: input,
        });
      }

      return apiFetch<Record<string, unknown>>(`/consultants/${consultant.id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["consultants"] });
      router.push(isQueuedOfflineResult(result) ? "/sync?queued=consultant" : `/consultants/${consultant.id}`);
    },
  });
  const submit = form.handleSubmit((values) => mutation.mutate(values));

  return (
    <form className="flex flex-col gap-5" onSubmit={(event) => void submit(event)}>
      <Card>
        <CardHeader>
          <CardTitle>Profil consultant</CardTitle>
          <CardDescription>Mettez a jour les coordonnees et la disponibilite de reference.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="fullName">Nom complet</FieldLabel>
              <Input id="fullName" {...form.register("fullName")} />
              {form.formState.errors.fullName ? <FieldError>Indiquez le nom complet.</FieldError> : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="email">Email professionnel</FieldLabel>
              <Input id="email" type="email" {...form.register("email")} />
              {form.formState.errors.email ? <FieldError>Indiquez un email valide.</FieldError> : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="phone">Telephone</FieldLabel>
              <Input id="phone" type="tel" {...form.register("phone")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="status">Disponibilite</FieldLabel>
              <select className="h-11 rounded-md border bg-white px-3 text-sm" id="status" {...form.register("status")}>
                <option value="ACTIVE">Actif</option>
                <option value="INACTIVE">Inactif</option>
                <option value="ARCHIVED">Archive</option>
              </select>
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
          {mutation.error instanceof ApiError ? mutation.error.message : "Impossible de modifier ce consultant."}
        </p>
      ) : null}
      <div className="sticky bottom-16 z-20 flex justify-end gap-3 rounded-lg border bg-white/95 p-3 shadow-md backdrop-blur lg:bottom-0">
        <Button asChild variant="outline">
          <Link href={`/consultants/${consultant.id}`}>Annuler</Link>
        </Button>
        <Button disabled={mutation.isPending} type="submit">
          {mutation.isPending ? "Enregistrement..." : "Enregistrer"}
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
