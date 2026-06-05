"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";
import type { z } from "zod";
import { clientUpdateSchema, type ClientUpdateInput } from "@abc/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, ApiError } from "@/lib/api";
import { enqueueOfflineMutation, isQueuedOfflineResult, shouldQueueOffline } from "@/lib/offline/outbox";
import type { QueuedOfflineResult } from "@/lib/offline/outbox";

type ClientResponse = {
  data: {
    id: string;
    companyName: string;
    fiscalNumber: string;
    address: string;
    zone: string | null;
    activitySector: string;
    applicationDomain: string | null;
    color: string;
    cadreCount: number;
    nonCadreCount: number;
    version: number;
    responsibleConsultants: Array<{ id: string; fullName: string; email: string }>;
    personnel: Array<{
      id: string;
      fullName: string;
      position: string | null;
      phone: string | null;
      email: string | null;
      type: "CADRE" | "NON_CADRE";
    }>;
  };
};

export function ClientEditForm({ clientId }: Readonly<{ clientId: string }>) {
  const query = useQuery({ queryKey: ["clients", clientId], queryFn: () => apiFetch<ClientResponse>(`/clients/${clientId}`) });
  if (query.isPending) return <Skeleton className="h-96 border" />;
  if (query.isError) return <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">Impossible de charger cette fiche client.</p>;
  return <LoadedClientEditForm client={query.data.data} />;
}

function LoadedClientEditForm({ client }: Readonly<{ client: ClientResponse["data"] }>) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const consultantsQuery = useQuery({
    queryKey: ["consultants", "assignment"],
    queryFn: () => apiFetch<{ data: Array<{ id: string; fullName: string; email: string }> }>("/consultants?status=ACTIVE&page=1&perPage=100"),
  });
  const form = useForm<z.input<typeof clientUpdateSchema>, unknown, ClientUpdateInput>({
    defaultValues: {
      companyName: client.companyName,
      fiscalNumber: client.fiscalNumber,
      address: client.address,
      zone: client.zone ?? "",
      activitySector: client.activitySector,
      applicationDomain: client.applicationDomain ?? "",
      color: client.color,
      cadreCount: client.cadreCount,
      nonCadreCount: client.nonCadreCount,
      contacts: client.personnel.map(({ email, fullName, phone, position, type }) => ({
        email: email ?? "",
        fullName,
        phone: phone ?? "",
        position: position ?? "",
        type,
      })),
      responsibleConsultantIds: client.responsibleConsultants.map(({ id }) => id),
      version: client.version,
    },
    resolver: zodResolver(clientUpdateSchema),
  });
  const contacts = useFieldArray({ control: form.control, name: "contacts" });
  const mutation = useMutation({
    mutationFn: (input: ClientUpdateInput): Promise<ClientResponse | QueuedOfflineResult> => {
      if (shouldQueueOffline()) {
        return enqueueOfflineMutation({
          baseVersion: client.version,
          entityId: client.id,
          entityType: "CLIENT",
          operation: "UPDATE",
          payload: input,
        });
      }

      return apiFetch<ClientResponse>(`/clients/${client.id}`, { method: "PATCH", body: JSON.stringify(input) });
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      router.push(isQueuedOfflineResult(result) ? "/sync?queued=client" : `/clients/${client.id}`);
    },
  });
  const submit = form.handleSubmit((values) => mutation.mutate(values));
  const totalEmployees = Number(form.watch("cadreCount") || 0) + Number(form.watch("nonCadreCount") || 0);

  return (
    <form className="flex flex-col gap-5" onSubmit={(event) => void submit(event)}>
      <Card>
        <CardHeader><CardTitle>Identité légale</CardTitle><CardDescription>Le matricule fiscal reste unique dans le portefeuille.</CardDescription></CardHeader>
        <CardContent><FieldGroup>
          <Field data-invalid={Boolean(form.formState.errors.companyName)}><FieldLabel htmlFor="companyName">Raison sociale</FieldLabel><Input id="companyName" aria-invalid={Boolean(form.formState.errors.companyName)} {...form.register("companyName")} />{form.formState.errors.companyName ? <FieldError>Indiquez une raison sociale valide.</FieldError> : null}</Field>
          <Field data-invalid={Boolean(form.formState.errors.fiscalNumber)}><FieldLabel htmlFor="fiscalNumber">Matricule fiscal</FieldLabel><Input id="fiscalNumber" aria-invalid={Boolean(form.formState.errors.fiscalNumber)} {...form.register("fiscalNumber")} />{form.formState.errors.fiscalNumber ? <FieldError>Indiquez un matricule fiscal valide.</FieldError> : null}</Field>
        </FieldGroup></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Identification dans le planning</CardTitle><CardDescription>Cette couleur repère le client dans le calendrier des missions.</CardDescription></CardHeader>
        <CardContent>
          <Field data-invalid={Boolean(form.formState.errors.color)}>
            <FieldLabel htmlFor="color">Couleur client</FieldLabel>
            <Input className="h-11 w-full max-w-32 p-1" id="color" type="color" aria-invalid={Boolean(form.formState.errors.color)} {...form.register("color")} />
            {form.formState.errors.color ? <FieldError>Choisissez une couleur client valide.</FieldError> : null}
          </Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Consultants responsables</CardTitle><CardDescription>Profils chargés du suivi de ce dossier client.</CardDescription></CardHeader>
        <CardContent>
          {consultantsQuery.isPending ? <Skeleton className="h-20" /> : null}
          {consultantsQuery.data?.data.length === 0 ? <p className="text-sm text-muted-foreground">Créez d’abord un consultant pour l’attribuer à ce dossier.</p> : null}
          <div className="flex flex-col gap-2">
            {consultantsQuery.data?.data.map((consultant) => <label className="flex min-h-11 items-center gap-3 rounded-md border px-3 py-2 text-sm" key={consultant.id}><input className="size-4 accent-brand-700" type="checkbox" value={consultant.id} {...form.register("responsibleConsultantIds")} /><span><strong className="font-medium">{consultant.fullName}</strong><span className="block text-xs text-muted-foreground">{consultant.email}</span></span></label>)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Contexte opérationnel</CardTitle><CardDescription>Repères utilisés par les consultants pour préparer les interventions.</CardDescription></CardHeader>
        <CardContent><FieldGroup>
          <Field data-invalid={Boolean(form.formState.errors.address)}><FieldLabel htmlFor="address">Adresse</FieldLabel><Textarea id="address" aria-invalid={Boolean(form.formState.errors.address)} {...form.register("address")} />{form.formState.errors.address ? <FieldError>Indiquez une adresse exploitable.</FieldError> : null}</Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field><FieldLabel htmlFor="zone">Zone</FieldLabel><Input id="zone" {...form.register("zone")} /></Field>
            <Field data-invalid={Boolean(form.formState.errors.activitySector)}><FieldLabel htmlFor="activitySector">Secteur d’activité</FieldLabel><Input id="activitySector" aria-invalid={Boolean(form.formState.errors.activitySector)} {...form.register("activitySector")} />{form.formState.errors.activitySector ? <FieldError>Indiquez le secteur d’activité.</FieldError> : null}</Field>
          </div>
          <Field><FieldLabel htmlFor="applicationDomain">Domaine d’application</FieldLabel><Input id="applicationDomain" {...form.register("applicationDomain")} /></Field>
        </FieldGroup></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Composition du personnel</CardTitle><CardDescription>Effectifs déclarés dans le dossier.</CardDescription></CardHeader>
        <CardContent><FieldGroup>
          <div className="grid grid-cols-2 gap-4">
            <Field><FieldLabel htmlFor="cadreCount">Cadres</FieldLabel><Input id="cadreCount" min="0" type="number" {...form.register("cadreCount")} /></Field>
            <Field><FieldLabel htmlFor="nonCadreCount">Non-cadres</FieldLabel><Input id="nonCadreCount" min="0" type="number" {...form.register("nonCadreCount")} /></Field>
          </div>
          <p className="text-sm text-muted-foreground">Effectif total calculé : <strong className="text-foreground">{totalEmployees}</strong></p>
        </FieldGroup></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Contacts opérationnels</CardTitle><CardDescription>Interlocuteurs à joindre lors de la préparation et du suivi des missions.</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-4">
          {contacts.fields.length === 0 ? <p className="text-sm text-muted-foreground">Aucun interlocuteur renseigné.</p> : null}
          {contacts.fields.map((contact, index) => (
            <fieldset className="flex flex-col gap-4 rounded-md border p-4" key={contact.id}>
              <legend className="px-1 text-sm font-semibold">Contact {index + 1}</legend>
              <FieldGroup>
                <Field data-invalid={Boolean(form.formState.errors.contacts?.[index]?.fullName)}>
                  <FieldLabel htmlFor={`contacts.${index}.fullName`}>Nom complet</FieldLabel>
                  <Input id={`contacts.${index}.fullName`} aria-invalid={Boolean(form.formState.errors.contacts?.[index]?.fullName)} {...form.register(`contacts.${index}.fullName`)} />
                  {form.formState.errors.contacts?.[index]?.fullName ? <FieldError>Indiquez le nom du contact.</FieldError> : null}
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field><FieldLabel htmlFor={`contacts.${index}.position`}>Fonction</FieldLabel><Input id={`contacts.${index}.position`} {...form.register(`contacts.${index}.position`)} /></Field>
                  <Field><FieldLabel htmlFor={`contacts.${index}.type`}>Catégorie</FieldLabel><select className="h-11 rounded-md border bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" id={`contacts.${index}.type`} {...form.register(`contacts.${index}.type`)}><option value="CADRE">Cadre</option><option value="NON_CADRE">Non-cadre</option></select></Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field><FieldLabel htmlFor={`contacts.${index}.phone`}>Téléphone</FieldLabel><Input id={`contacts.${index}.phone`} type="tel" {...form.register(`contacts.${index}.phone`)} /></Field>
                  <Field data-invalid={Boolean(form.formState.errors.contacts?.[index]?.email)}><FieldLabel htmlFor={`contacts.${index}.email`}>Email</FieldLabel><Input id={`contacts.${index}.email`} type="email" aria-invalid={Boolean(form.formState.errors.contacts?.[index]?.email)} {...form.register(`contacts.${index}.email`)} />{form.formState.errors.contacts?.[index]?.email ? <FieldError>Indiquez un email valide ou laissez le champ vide.</FieldError> : null}</Field>
                </div>
              </FieldGroup>
              <Button className="self-start" onClick={() => contacts.remove(index)} size="sm" type="button" variant="outline"><Trash2 data-icon="inline-start" />Retirer ce contact</Button>
            </fieldset>
          ))}
          <Button className="self-start" onClick={() => contacts.append({ email: "", fullName: "", phone: "", position: "", type: "CADRE" })} type="button" variant="outline"><Plus data-icon="inline-start" />Ajouter un contact</Button>
        </CardContent>
      </Card>
      {mutation.isError ? <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">{mutation.error instanceof ApiError ? mutation.error.message : "Impossible d’enregistrer les modifications."}</p> : null}
      <div className="sticky bottom-16 z-20 flex items-center justify-end gap-3 rounded-lg border bg-white/95 p-3 shadow-md backdrop-blur lg:bottom-0">
        <Button asChild type="button" variant="outline"><Link href={`/clients/${client.id}`}>Annuler</Link></Button>
        <Button disabled={mutation.isPending} type="submit">{mutation.isPending ? "Enregistrement..." : "Enregistrer"}</Button>
      </div>
    </form>
  );
}

