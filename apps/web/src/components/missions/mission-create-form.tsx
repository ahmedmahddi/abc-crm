"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { MISSION_TYPE_LABELS, MISSION_TYPES, missionCreateSchema, type MissionCreateInput } from "@abc/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, ApiError } from "@/lib/api";
import { enqueueOfflineMutation, isQueuedOfflineResult, shouldQueueOffline } from "@/lib/offline/outbox";
import type { QueuedOfflineResult } from "@/lib/offline/outbox";

type Client = { id: string; companyName: string };
type Consultant = { id: string; fullName: string; email: string };
type ListResponse<T> = { data: T[] };

export function MissionCreateForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const clients = useQuery({
    queryKey: ["clients", "active-options"],
    queryFn: () => apiFetch<ListResponse<Client>>("/clients?status=ACTIVE&page=1&perPage=100"),
  });
  const consultants = useQuery({
    queryKey: ["consultants", "active-options"],
    queryFn: () => apiFetch<ListResponse<Consultant>>("/consultants?status=ACTIVE&page=1&perPage=100"),
  });
  const form = useForm<z.input<typeof missionCreateSchema>, unknown, MissionCreateInput>({
    defaultValues: {
      clientId: "",
      consultantAssignments: [],
      description: "",
      endDateTime: "",
      location: "",
      missionMode: "PRESENTIELLE",
      missionType: "AUDIT",
      missionTypeOtherLabel: "",
      startDateTime: "",
      status: "PLANNED",
      title: "",
    },
    resolver: zodResolver(missionCreateSchema),
  });
  const consultantAssignments = form.watch("consultantAssignments") ?? [];
  const missionType = form.watch("missionType");
  const mutation = useMutation({
    mutationFn: (input: MissionCreateInput): Promise<Record<string, unknown> | QueuedOfflineResult> => {
      if (shouldQueueOffline()) {
        return enqueueOfflineMutation({ entityType: "MISSION", operation: "CREATE", payload: input });
      }

      return apiFetch<Record<string, unknown>>("/missions", { method: "POST", body: JSON.stringify(input) });
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["missions"] });
      router.push(isQueuedOfflineResult(result) ? "/sync?queued=mission" : "/calendar");
    },
  });
  const submit = form.handleSubmit((values) => mutation.mutate(values));

  return (
    <form className="flex flex-col gap-5" onSubmit={(event) => void submit(event)}>
      <Card>
        <CardHeader>
          <CardTitle>Cadre de la mission</CardTitle>
          <CardDescription>
            Definissez le cadre operationnel visible dans le calendrier et les fiches mission.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field data-invalid={Boolean(form.formState.errors.title)}>
              <FieldLabel htmlFor="title">Objet de la mission</FieldLabel>
              <Input id="title" aria-invalid={Boolean(form.formState.errors.title)} {...form.register("title")} />
              {form.formState.errors.title ? <FieldError>Indiquez un objet precis.</FieldError> : null}
            </Field>
            <Field data-invalid={Boolean(form.formState.errors.clientId)}>
              <FieldLabel htmlFor="clientId">Client</FieldLabel>
              <select
                className="h-11 rounded-md border bg-white px-3 text-sm"
                id="clientId"
                aria-invalid={Boolean(form.formState.errors.clientId)}
                {...form.register("clientId")}
              >
                <option value="">Selectionner un client</option>
                {clients.data?.data.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.companyName}
                  </option>
                ))}
              </select>
              {form.formState.errors.clientId ? <FieldError>Selectionnez un client actif.</FieldError> : null}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="missionType">Type</FieldLabel>
                <select className="h-11 rounded-md border bg-white px-3 text-sm" id="missionType" {...form.register("missionType")}>
                  {MISSION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {MISSION_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="missionMode">Mode</FieldLabel>
                <select className="h-11 rounded-md border bg-white px-3 text-sm" id="missionMode" {...form.register("missionMode")}>
                  <option value="PRESENTIELLE">Presentielle</option>
                  <option value="ONLINE">En ligne</option>
                </select>
              </Field>
            </div>
            {missionType === "AUTRE" ? (
              <Field data-invalid={Boolean(form.formState.errors.missionTypeOtherLabel)}>
                <FieldLabel htmlFor="missionTypeOtherLabel">Type personnalise *</FieldLabel>
                <Input
                  id="missionTypeOtherLabel"
                  aria-invalid={Boolean(form.formState.errors.missionTypeOtherLabel)}
                  {...form.register("missionTypeOtherLabel")}
                />
                {form.formState.errors.missionTypeOtherLabel ? (
                  <FieldError>Precisez le type de mission.</FieldError>
                ) : null}
              </Field>
            ) : null}
          </FieldGroup>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Planification terrain</CardTitle>
          <CardDescription>Ces informations apparaissent dans l'agenda consultant et la fiche mission.</CardDescription>
        </CardHeader>
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
            <Field>
              <FieldLabel htmlFor="location">Lieu ou lien de reunion</FieldLabel>
              <Input id="location" {...form.register("location")} />
              <FieldDescription>Renseignez l'adresse client ou le lien de visioconference utile au consultant.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="description">Consignes</FieldLabel>
              <Textarea id="description" {...form.register("description")} />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Equipe affectee</CardTitle>
          <CardDescription>Choisissez les consultants et leur responsabilite dans cette mission.</CardDescription>
        </CardHeader>
        <CardContent>
          {consultants.isPending ? <p className="text-sm text-muted-foreground">Chargement des consultants...</p> : null}
          {consultants.data?.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Creez au moins un consultant actif avant de planifier une mission.</p>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            {consultants.data?.data.map((consultant) => {
              const assignment = consultantAssignments.find((item) => item.consultantId === consultant.id);
              return (
                <div className="flex min-h-14 flex-col gap-2 rounded-md border bg-white px-3 py-2 text-sm" key={consultant.id}>
                  <label className="flex items-center gap-3">
                    <input
                      className="size-4 accent-brand-700"
                      type="checkbox"
                      checked={Boolean(assignment)}
                      onChange={(event) => toggleConsultantAssignment(form, consultant.id, event.target.checked)}
                    />
                    <span>
                      <span className="block font-medium">{consultant.fullName}</span>
                      <span className="block text-xs text-muted-foreground">{consultant.email}</span>
                    </span>
                  </label>
                  {assignment ? (
                    <select
                      className="h-10 rounded-md border bg-white px-3 text-sm"
                      value={assignment.role}
                      onChange={(event) => updateConsultantRole(form, consultant.id, event.target.value as "RESPONSABLE" | "PARTICIPANT")}
                    >
                      <option value="RESPONSABLE">Responsable</option>
                      <option value="PARTICIPANT">Participant</option>
                    </select>
                  ) : null}
                </div>
              );
            })}
          </div>
          {form.formState.errors.consultantAssignments ? (
            <FieldError className="mt-2">Selectionnez au moins un consultant responsable.</FieldError>
          ) : null}
        </CardContent>
      </Card>
      {clients.isError || consultants.isError ? (
        <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">
          Impossible de charger les options de planification.
        </p>
      ) : null}
      {mutation.isError ? (
        <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">
          {mutation.error instanceof ApiError ? mutation.error.message : "Impossible de creer la mission."}
        </p>
      ) : null}
      <div className="sticky bottom-16 z-20 flex justify-end gap-3 rounded-lg border bg-white/95 p-3 shadow-md backdrop-blur lg:bottom-0">
        <Button asChild variant="outline">
          <Link href="/calendar">Annuler</Link>
        </Button>
        <Button disabled={mutation.isPending || clients.isError || consultants.isError} type="submit">
          {mutation.isPending ? "Creation..." : "Creer la mission"}
        </Button>
      </div>
    </form>
  );
}

type MissionForm = ReturnType<typeof useForm<z.input<typeof missionCreateSchema>, unknown, MissionCreateInput>>;

function toggleConsultantAssignment(form: MissionForm, consultantId: string, checked: boolean) {
  const current = form.getValues("consultantAssignments") ?? [];
  if (checked) {
    form.setValue(
      "consultantAssignments",
      [
        ...current,
        {
          consultantId,
          role: current.some((assignment) => assignment.role === "RESPONSABLE") ? "PARTICIPANT" : "RESPONSABLE",
        },
      ],
      { shouldDirty: true, shouldValidate: true },
    );
    return;
  }
  form.setValue(
    "consultantAssignments",
    current.filter((assignment) => assignment.consultantId !== consultantId),
    { shouldDirty: true, shouldValidate: true },
  );
}

function updateConsultantRole(form: MissionForm, consultantId: string, role: "RESPONSABLE" | "PARTICIPANT") {
  form.setValue(
    "consultantAssignments",
    (form.getValues("consultantAssignments") ?? []).map((assignment) =>
      assignment.consultantId === consultantId ? { ...assignment, role } : assignment,
    ),
    { shouldDirty: true, shouldValidate: true },
  );
}
