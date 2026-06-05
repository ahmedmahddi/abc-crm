"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CLIENT_DOCUMENT_UPLOAD_RULES, type ClientDocumentType } from "@abc/shared";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import type { z } from "zod";
import { clientCreateSchema, type ClientCreateInput } from "@abc/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, apiUpload, ApiError } from "@/lib/api";
import { enqueueOfflineMutation, shouldQueueOffline } from "@/lib/offline/outbox";
import { stageClientDocumentUploads } from "@/lib/offline/uploads";

type CreateClientResponse = { data: { id: string } };
type CreateClientMutationResult = CreateClientResponse & { failedUploads: number };
type DocumentDrafts = Partial<Record<ClientDocumentType, File>>;

const INITIAL_DOCUMENT_TYPES = ["LOGO", "PATENTE", "RNE", "ORGANIGRAMME", "PERSONNEL_LIST"] as const;

const defaultValues: ClientCreateInput = {
  companyName: "",
  fiscalNumber: "",
  address: "",
  zone: "",
  activitySector: "",
  applicationDomain: "",
  reference: "",
  color: "#125885",
  cadreCount: 0,
  nonCadreCount: 0,
  responsibleConsultantIds: [],
  contacts: [],
};

export function ClientCreateForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [documentDrafts, setDocumentDrafts] = useState<DocumentDrafts>({});
  const consultantsQuery = useQuery({
    queryKey: ["consultants", "assignment"],
    queryFn: () => apiFetch<{ data: Array<{ id: string; fullName: string; email: string }> }>("/consultants?status=ACTIVE&page=1&perPage=100"),
  });
  const form = useForm<z.input<typeof clientCreateSchema>, unknown, ClientCreateInput>({
    defaultValues,
    resolver: zodResolver(clientCreateSchema),
  });
  const contacts = useFieldArray({ control: form.control, name: "contacts" });
  const mutation = useMutation({
    mutationFn: async (input: ClientCreateInput) => {
      validateDocumentDrafts(documentDrafts);
      if (shouldQueueOffline()) {
        const queued = await enqueueOfflineMutation({ entityType: "CLIENT", operation: "CREATE", payload: input });
        await stageClientDocumentUploads({ clientMutationId: queued.clientMutationId, drafts: documentDrafts });
        return { ...queued, failedUploads: Object.keys(documentDrafts).length };
      }

      const response = await apiFetch<CreateClientResponse>("/clients", { method: "POST", body: JSON.stringify(input) });
      const uploads = await Promise.allSettled(
        Object.entries(documentDrafts).map(async ([type, file]) => {
          const body = new FormData();
          body.append("file", file);
          body.append("type", type);
          return apiUpload(`/clients/${response.data.id}/documents`, body);
        }),
      );
      return { ...response, failedUploads: uploads.filter(({ status }) => status === "rejected").length };
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      if (isQueuedOffline(result)) {
        router.push(`/sync?queued=client${result.failedUploads > 0 ? "&uploads=pending" : ""}`);
        return;
      }
      const { data, failedUploads } = result;
      router.push(`/clients/${data.id}${failedUploads > 0 ? "?upload=partial" : ""}`);
    },
  });

  const submit = form.handleSubmit((values) => mutation.mutate(values));
  const totalEmployees = Number(form.watch("cadreCount") || 0) + Number(form.watch("nonCadreCount") || 0);

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Identité légale</CardTitle>
          <CardDescription>Renseignez ce que vous avez maintenant. Les champs peuvent être complétés plus tard.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field data-invalid={Boolean(form.formState.errors.companyName)}>
              <FieldLabel htmlFor="companyName">Raison sociale</FieldLabel>
              <Input id="companyName" aria-invalid={Boolean(form.formState.errors.companyName)} {...form.register("companyName")} />
              {form.formState.errors.companyName ? <FieldError>La raison sociale n’a pas pu être validée.</FieldError> : null}
            </Field>
            <Field data-invalid={Boolean(form.formState.errors.fiscalNumber)}>
              <FieldLabel htmlFor="fiscalNumber">Matricule fiscal</FieldLabel>
              <Input id="fiscalNumber" aria-invalid={Boolean(form.formState.errors.fiscalNumber)} {...form.register("fiscalNumber")} />
              <FieldDescription>Facultatif à la création. S'il est renseigné, il doit rester unique dans le CRM.</FieldDescription>
              {form.formState.errors.fiscalNumber ? <FieldError>Le matricule fiscal n’a pas pu être validé.</FieldError> : null}
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Identification dans le planning</CardTitle>
          <CardDescription>Cette couleur repère le client dans le calendrier des missions.</CardDescription>
        </CardHeader>
        <CardContent>
          <Field data-invalid={Boolean(form.formState.errors.color)}>
            <FieldLabel htmlFor="color">Couleur client</FieldLabel>
            <Input className="h-11 w-full max-w-32 p-1" id="color" type="color" aria-invalid={Boolean(form.formState.errors.color)} {...form.register("color")} />
            <FieldDescription>Utilisez une couleur suffisamment distincte pour reconnaître les missions de ce client.</FieldDescription>
            {form.formState.errors.color ? <FieldError>Choisissez une couleur client valide.</FieldError> : null}
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Consultants responsables</CardTitle>
          <CardDescription>Profils chargés du suivi de ce dossier client.</CardDescription>
        </CardHeader>
        <CardContent>
          {consultantsQuery.isPending ? <p className="text-sm text-muted-foreground">Chargement des consultants...</p> : null}
          {consultantsQuery.data?.data.length === 0 ? <p className="text-sm text-muted-foreground">Créez d'abord un consultant pour l'attribuer à ce dossier.</p> : null}
          <div className="flex flex-col gap-2">
            {consultantsQuery.data?.data.map((consultant) => (
              <label className="flex min-h-11 items-center gap-3 rounded-md border px-3 py-2 text-sm" key={consultant.id}>
                <input className="size-4 accent-brand-700" type="checkbox" value={consultant.id} {...form.register("responsibleConsultantIds")} />
                <span><strong className="font-medium">{consultant.fullName}</strong><span className="block text-xs text-muted-foreground">{consultant.email}</span></span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contexte opérationnel</CardTitle>
          <CardDescription>Adresse et domaine d’intervention visibles lors de la préparation des missions.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field data-invalid={Boolean(form.formState.errors.address)}>
              <FieldLabel htmlFor="address">Adresse</FieldLabel>
              <Textarea id="address" aria-invalid={Boolean(form.formState.errors.address)} {...form.register("address")} />
              {form.formState.errors.address ? <FieldError>L’adresse n’a pas pu être validée.</FieldError> : null}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="zone">Zone</FieldLabel>
                <Input id="zone" placeholder="Ville, région ou zone" {...form.register("zone")} />
              </Field>
              <Field data-invalid={Boolean(form.formState.errors.activitySector)}>
                <FieldLabel htmlFor="activitySector">Secteur d’activité</FieldLabel>
                <Input id="activitySector" aria-invalid={Boolean(form.formState.errors.activitySector)} {...form.register("activitySector")} />
                {form.formState.errors.activitySector ? <FieldError>Le secteur d’activité n’a pas pu être validé.</FieldError> : null}
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="applicationDomain">Domaine d’application</FieldLabel>
              <Input id="applicationDomain" placeholder="Périmètre ou activité concernée" {...form.register("applicationDomain")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="reference">Référence</FieldLabel>
              <Input id="reference" placeholder="Référence interne ou dossier client" {...form.register("reference")} />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contacts cadres</CardTitle>
          <CardDescription>Coordonnées des interlocuteurs à joindre pour préparer et suivre les missions.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {contacts.fields.length === 0 ? <p className="text-sm text-muted-foreground">Aucun contact cadre renseigné.</p> : null}
          {contacts.fields.map((contact, index) => (
            <fieldset className="flex flex-col gap-4 rounded-md border p-4" key={contact.id}>
              <legend className="px-1 text-sm font-semibold">Contact cadre {index + 1}</legend>
              <FieldGroup>
                <Field data-invalid={Boolean(form.formState.errors.contacts?.[index]?.fullName)}>
                  <FieldLabel htmlFor={`contacts.${index}.fullName`}>Nom complet</FieldLabel>
                  <Input id={`contacts.${index}.fullName`} aria-invalid={Boolean(form.formState.errors.contacts?.[index]?.fullName)} {...form.register(`contacts.${index}.fullName`)} />
                  {form.formState.errors.contacts?.[index]?.fullName ? <FieldError>Le nom du contact n’a pas pu être validé.</FieldError> : null}
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field><FieldLabel htmlFor={`contacts.${index}.position`}>Fonction</FieldLabel><Input id={`contacts.${index}.position`} {...form.register(`contacts.${index}.position`)} /></Field>
                  <Field><FieldLabel htmlFor={`contacts.${index}.phone`}>Téléphone</FieldLabel><Input id={`contacts.${index}.phone`} type="tel" {...form.register(`contacts.${index}.phone`)} /></Field>
                </div>
                <Field data-invalid={Boolean(form.formState.errors.contacts?.[index]?.email)}>
                  <FieldLabel htmlFor={`contacts.${index}.email`}>Email</FieldLabel>
                  <Input id={`contacts.${index}.email`} type="email" aria-invalid={Boolean(form.formState.errors.contacts?.[index]?.email)} {...form.register(`contacts.${index}.email`)} />
                  {form.formState.errors.contacts?.[index]?.email ? <FieldError>Indiquez un email valide ou laissez le champ vide.</FieldError> : null}
                </Field>
              </FieldGroup>
              <Button className="self-start" onClick={() => contacts.remove(index)} size="sm" type="button" variant="outline"><Trash2 data-icon="inline-start" />Retirer ce contact</Button>
            </fieldset>
          ))}
          <Button className="self-start" onClick={() => contacts.append({ email: "", fullName: "", phone: "", position: "", type: "CADRE" })} type="button" variant="outline"><Plus data-icon="inline-start" />Ajouter un contact cadre</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Composition du personnel</CardTitle>
          <CardDescription>Les effectifs alimentent la fiche client et les préparations de mission.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <Field data-invalid={Boolean(form.formState.errors.cadreCount)}>
                <FieldLabel htmlFor="cadreCount">Cadres</FieldLabel>
                <Input id="cadreCount" min="0" type="number" {...form.register("cadreCount")} />
                {form.formState.errors.cadreCount ? <FieldError>Saisissez un nombre positif.</FieldError> : null}
              </Field>
              <Field data-invalid={Boolean(form.formState.errors.nonCadreCount)}>
                <FieldLabel htmlFor="nonCadreCount">Non-cadres</FieldLabel>
                <Input id="nonCadreCount" min="0" type="number" {...form.register("nonCadreCount")} />
                {form.formState.errors.nonCadreCount ? <FieldError>Saisissez un nombre positif.</FieldError> : null}
              </Field>
            </div>
            <p className="text-sm text-muted-foreground">Effectif total calculé : <strong className="text-foreground">{totalEmployees}</strong></p>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Justificatifs du dossier</CardTitle>
          <CardDescription>Sélectionnez les fichiers disponibles. Ils seront transférés vers le stockage privé après la création du client.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {INITIAL_DOCUMENT_TYPES.map((type) => {
            const rule = CLIENT_DOCUMENT_UPLOAD_RULES[type];
            return (
              <Field key={type}>
                <FieldLabel htmlFor={`document-${type}`}>{rule.label}</FieldLabel>
                <input accept={rule.accept} className="block min-h-11 w-full rounded-md border bg-white px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:font-medium" id={`document-${type}`} onChange={(event) => updateDocumentDraft(setDocumentDrafts, type, event.target.files?.[0])} type="file" />
                <FieldDescription>{rule.acceptedLabel} · maximum {rule.maxSizeLabel}</FieldDescription>
              </Field>
            );
          })}
        </CardContent>
      </Card>

      {mutation.isError ? (
        <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">
          {mutation.error instanceof ApiError ? mutation.error.message : "Impossible de créer le client. Réessayez."}
        </p>
      ) : null}

      <div className="sticky bottom-16 z-20 flex items-center justify-end gap-3 rounded-lg border bg-white/95 p-3 shadow-md backdrop-blur lg:bottom-0">
        <Button asChild type="button" variant="outline">
          <Link href="/clients">Annuler</Link>
        </Button>
        <Button disabled={mutation.isPending} type="submit">
          {mutation.isPending ? "Création..." : "Créer le client"}
        </Button>
      </div>
    </form>
  );
}

function updateDocumentDraft(setDrafts: React.Dispatch<React.SetStateAction<DocumentDrafts>>, type: ClientDocumentType, file?: File) {
  setDrafts((current) => {
    const next = { ...current };
    if (file) next[type] = file;
    else delete next[type];
    return next;
  });
}

function validateDocumentDrafts(drafts: DocumentDrafts) {
  for (const [type, file] of Object.entries(drafts) as Array<[ClientDocumentType, File]>) {
    const rule = CLIENT_DOCUMENT_UPLOAD_RULES[type];
    if (file.size > rule.maxSizeBytes) throw new Error(`${rule.label} : le fichier dépasse ${rule.maxSizeLabel}.`);
    if (!rule.mimeTypes.includes(file.type)) throw new Error(`${rule.label} : utilisez ${rule.acceptedLabel}.`);
  }
}

function isQueuedOffline(result: CreateClientMutationResult | { queuedOffline: true; failedUploads: number }): result is { queuedOffline: true; failedUploads: number } {
  return "queuedOffline" in result;
}
