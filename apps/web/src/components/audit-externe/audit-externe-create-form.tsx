"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import type { UseFormRegister, UseFormWatch } from "react-hook-form";
import { auditExterneCreateSchema, type AuditExterneCreateInput } from "@abc/shared";
import { AuditExterneFields, type AuditExterneFieldValues } from "@/components/audit-externe/audit-externe-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiFetch, ApiError } from "@/lib/api";

export function AuditExterneCreateForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useForm<z.input<typeof auditExterneCreateSchema>, unknown, AuditExterneCreateInput>({
    defaultValues: {
      clientId: "",
      responsableId: "",
      typeAudit: "CERTIFICATION",
      reference: "NORME_9001",
      organisme: "",
      auditeur: "",
      missionMode: "PRESENTIELLE",
      startDateTime: "",
      endDateTime: "",
      location: "",
    },
    resolver: zodResolver(auditExterneCreateSchema),
  });
  const mutation = useMutation({
    mutationFn: (input: AuditExterneCreateInput) => apiFetch<{ data: { id: string } }>("/audit-externe", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["audit-externe"] });
      await queryClient.invalidateQueries({ queryKey: ["missions"] });
      router.push(`/audit-externe/${result.data.id}`);
    },
  });
  const submit = form.handleSubmit((values) => mutation.mutate(values));

  return (
    <form className="flex flex-col gap-5" onSubmit={(event) => void submit(event)}>
      <Card>
        <CardHeader><CardTitle>Details de l&apos;audit</CardTitle></CardHeader>
        <CardContent>
          <FieldGroup>
            <AuditExterneFields
              register={form.register as unknown as UseFormRegister<AuditExterneFieldValues>}
              errors={form.formState.errors}
              watch={form.watch as unknown as UseFormWatch<AuditExterneFieldValues>}
            />
          </FieldGroup>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Planification</CardTitle></CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(form.formState.errors.startDateTime)}>
                <FieldLabel htmlFor="startDateTime">Debut</FieldLabel>
                <Input id="startDateTime" type="datetime-local" aria-invalid={Boolean(form.formState.errors.startDateTime)} {...form.register("startDateTime")} />
              </Field>
              <Field data-invalid={Boolean(form.formState.errors.endDateTime)}>
                <FieldLabel htmlFor="endDateTime">Fin</FieldLabel>
                <Input id="endDateTime" type="datetime-local" aria-invalid={Boolean(form.formState.errors.endDateTime)} {...form.register("endDateTime")} />
                {form.formState.errors.endDateTime ? <FieldError>La fin doit suivre le debut.</FieldError> : null}
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="missionMode">Mode</FieldLabel>
                <select className="h-11 rounded-md border bg-white px-3 text-sm" id="missionMode" {...form.register("missionMode")}>
                  <option value="PRESENTIELLE">Presentielle</option>
                  <option value="ONLINE">En ligne</option>
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="location">Lieu</FieldLabel>
                <Input id="location" {...form.register("location")} />
              </Field>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>
      {mutation.isError ? (
        <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">
          {mutation.error instanceof ApiError ? mutation.error.message : "Impossible de creer l'audit externe."}
        </p>
      ) : null}
      <div className="sticky bottom-16 z-20 flex justify-end gap-3 rounded-lg border bg-white/95 p-3 shadow-md backdrop-blur lg:bottom-0">
        <Button asChild variant="outline"><Link href="/audit-externe">Annuler</Link></Button>
        <Button disabled={mutation.isPending} type="submit">{mutation.isPending ? "Creation..." : "Creer l'audit"}</Button>
      </div>
    </form>
  );
}
