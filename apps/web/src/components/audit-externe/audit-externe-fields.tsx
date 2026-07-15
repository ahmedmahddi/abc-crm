"use client";

import { useQuery } from "@tanstack/react-query";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { AUDIT_EXTERNE_REFERENCES, AUDIT_EXTERNE_REFERENCE_LABELS, AUDIT_EXTERNE_TYPES, AUDIT_EXTERNE_TYPE_LABELS } from "@abc/shared";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";

type Client = { id: string; companyName: string };
type Responsable = { id: string; name: string; email: string };
type ListResponse<T> = { data: T[] };

export type AuditExterneFieldValues = {
  clientId?: string;
  responsableId?: string;
  typeAudit?: string;
  reference?: string;
  organisme?: string;
  auditeur?: string;
};

export function AuditExterneFields({
  register,
  errors,
}: Readonly<{
  register: UseFormRegister<AuditExterneFieldValues>;
  errors: FieldErrors<AuditExterneFieldValues>;
}>) {
  const clients = useQuery({
    queryKey: ["clients", "active-options"],
    queryFn: () => apiFetch<ListResponse<Client>>("/clients?status=ACTIVE&page=1&perPage=100"),
  });
  const responsables = useQuery({
    queryKey: ["audit-externe", "responsables"],
    queryFn: () => apiFetch<ListResponse<Responsable>>("/audit-externe/responsables"),
  });

  return (
    <>
      <Field data-invalid={Boolean(errors.clientId)}>
        <FieldLabel htmlFor="ae-clientId">Client</FieldLabel>
        <select className="h-11 rounded-md border bg-white px-3 text-sm" id="ae-clientId" {...register("clientId")}>
          <option value="">Selectionner un client</option>
          {clients.data?.data.map((client) => (
            <option key={client.id} value={client.id}>
              {client.companyName}
            </option>
          ))}
        </select>
        {errors.clientId ? <FieldError>Selectionnez un client actif.</FieldError> : null}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={Boolean(errors.typeAudit)}>
          <FieldLabel htmlFor="ae-typeAudit">Type d&apos;audit</FieldLabel>
          <select className="h-11 rounded-md border bg-white px-3 text-sm" id="ae-typeAudit" {...register("typeAudit")}>
            {AUDIT_EXTERNE_TYPES.map((type) => (
              <option key={type} value={type}>
                {AUDIT_EXTERNE_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </Field>
        <Field data-invalid={Boolean(errors.reference)}>
          <FieldLabel htmlFor="ae-reference">Reference</FieldLabel>
          <select className="h-11 rounded-md border bg-white px-3 text-sm" id="ae-reference" {...register("reference")}>
            {AUDIT_EXTERNE_REFERENCES.map((reference) => (
              <option key={reference} value={reference}>
                {AUDIT_EXTERNE_REFERENCE_LABELS[reference]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field data-invalid={Boolean(errors.organisme)}>
        <FieldLabel htmlFor="ae-organisme">Organisme de certification</FieldLabel>
        <Input id="ae-organisme" aria-invalid={Boolean(errors.organisme)} {...register("organisme")} />
        {errors.organisme ? <FieldError>Indiquez l&apos;organisme certificateur.</FieldError> : null}
      </Field>
      <Field data-invalid={Boolean(errors.auditeur)}>
        <FieldLabel htmlFor="ae-auditeur">Auditeur</FieldLabel>
        <Input id="ae-auditeur" aria-invalid={Boolean(errors.auditeur)} {...register("auditeur")} />
        {errors.auditeur ? <FieldError>Indiquez le nom de l&apos;auditeur.</FieldError> : null}
      </Field>
      <Field data-invalid={Boolean(errors.responsableId)}>
        <FieldLabel htmlFor="ae-responsableId">Responsable</FieldLabel>
        <select className="h-11 rounded-md border bg-white px-3 text-sm" id="ae-responsableId" {...register("responsableId")}>
          <option value="">Selectionner un responsable</option>
          {responsables.data?.data.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
        {errors.responsableId ? <FieldError>Selectionnez le responsable a notifier.</FieldError> : null}
      </Field>
    </>
  );
}
