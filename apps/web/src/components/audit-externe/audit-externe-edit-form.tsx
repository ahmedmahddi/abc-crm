"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import type { UseFormRegister, UseFormWatch } from "react-hook-form";
import { auditExterneUpdateSchema, type AuditExterneUpdateInput } from "@abc/shared";
import { AuditExterneFields, type AuditExterneFieldValues } from "@/components/audit-externe/audit-externe-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiError } from "@/lib/api";

type AuditExterneResponse = {
  data: {
    id: string;
    version: number;
    typeAudit: string;
    reference: string;
    organisme: string;
    auditeur: string;
    startDateTime: string;
    endDateTime: string;
    missionMode: "ONLINE" | "PRESENTIELLE";
    location: string | null;
    client: { id: string };
    responsable: { id: string };
  };
};

export function AuditExterneEditForm({ id }: Readonly<{ id: string }>) {
  const query = useQuery({ queryKey: ["audit-externe", id], queryFn: () => apiFetch<AuditExterneResponse>(`/audit-externe/${id}`) });
  if (query.isPending) return <Skeleton className="h-96 border" />;
  if (query.isError) return <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">Impossible de charger cet audit externe.</p>;
  return <LoadedAuditExterneEditForm record={query.data.data} />;
}

function LoadedAuditExterneEditForm({ record }: Readonly<{ record: AuditExterneResponse["data"] }>) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useForm<z.input<typeof auditExterneUpdateSchema>, unknown, AuditExterneUpdateInput>({
    defaultValues: {
      clientId: record.client.id,
      responsableId: record.responsable.id,
      typeAudit: record.typeAudit as AuditExterneUpdateInput["typeAudit"],
      reference: record.reference as AuditExterneUpdateInput["reference"],
      organisme: record.organisme,
      auditeur: record.auditeur,
      missionMode: record.missionMode,
      startDateTime: record.startDateTime.slice(0, 16),
      endDateTime: record.endDateTime.slice(0, 16),
      location: record.location ?? "",
      version: record.version,
    },
    resolver: zodResolver(auditExterneUpdateSchema),
  });
  const mutation = useMutation({
    mutationFn: (input: AuditExterneUpdateInput) => apiFetch<AuditExterneResponse>(`/audit-externe/${record.id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["audit-externe"] });
      router.push(`/audit-externe/${record.id}`);
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
          {mutation.error instanceof ApiError ? mutation.error.message : "Impossible d'enregistrer les modifications."}
        </p>
      ) : null}
      <div className="sticky bottom-16 z-20 flex justify-end gap-3 rounded-lg border bg-white/95 p-3 shadow-md backdrop-blur lg:bottom-0">
        <Button asChild type="button" variant="outline"><Link href={`/audit-externe/${record.id}`}>Annuler</Link></Button>
        <Button disabled={mutation.isPending} type="submit">{mutation.isPending ? "Enregistrement..." : "Enregistrer"}</Button>
      </div>
    </form>
  );
}
