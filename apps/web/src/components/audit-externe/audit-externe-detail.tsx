"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AUDIT_EXTERNE_REFERENCE_LABELS, AUDIT_EXTERNE_TYPE_LABELS, type AuditExterneReference, type AuditExterneType } from "@abc/shared";
import { Archive, Edit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RoleGate } from "@/components/auth/role-gate";
import { PageHeader, PagePanel, PageStack } from "@/components/layout/page-section";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiError } from "@/lib/api";

type AuditExterneDetail = {
  id: string;
  typeAudit: AuditExterneType;
  reference: AuditExterneReference;
  organisme: string;
  auditeur: string;
  startDateTime: string;
  endDateTime: string;
  missionMode: "ONLINE" | "PRESENTIELLE";
  location: string | null;
  status: "PLANNED" | "DONE" | "CANCELLED";
  reminderSentAt: string | null;
  client: { id: string; companyName: string };
  responsable: { id: string; name: string; email: string };
};

export function AuditExterneDetail({ id }: Readonly<{ id: string }>) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["audit-externe", id], queryFn: () => apiFetch<{ data: AuditExterneDetail }>(`/audit-externe/${id}`) });
  const archiveMutation = useMutation({
    mutationFn: () => apiFetch(`/audit-externe/${id}/archive`, { method: "POST" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["audit-externe"] });
      await queryClient.invalidateQueries({ queryKey: ["audit-externe", id] });
    },
  });

  if (query.isPending) return <Skeleton className="h-96 border" />;
  if (query.isError) return <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">Impossible de charger cet audit externe.</p>;

  const record = query.data.data;

  return (
    <PageStack>
      <Breadcrumbs items={[{ href: "/audit-externe", label: "Audit Externe" }, { label: record.client.companyName }]} />
      <PageHeader
        actions={
          <RoleGate allowedRoles={["ADMIN", "RESPONSABLE"]}>
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline"><Link href={`/audit-externe/${record.id}/modifier`}><Edit aria-hidden="true" />Modifier</Link></Button>
              {record.status !== "CANCELLED" ? (
                <Button disabled={archiveMutation.isPending} onClick={() => archiveMutation.mutate()} size="sm" type="button" variant="danger">
                  <Archive aria-hidden="true" />Archiver
                </Button>
              ) : null}
            </div>
          </RoleGate>
        }
        eyebrow={AUDIT_EXTERNE_TYPE_LABELS[record.typeAudit]}
        title={record.client.companyName}
        description={`${AUDIT_EXTERNE_REFERENCE_LABELS[record.reference]} - ${record.organisme}`}
      />
      {archiveMutation.error ? (
        <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">
          {archiveMutation.error instanceof ApiError ? archiveMutation.error.message : "Impossible d'archiver cet audit."}
        </p>
      ) : null}
      <PagePanel as="section">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div><dt className="text-xs text-muted-foreground">Date d&apos;audit</dt><dd className="mt-1 font-medium">{new Date(record.startDateTime).toLocaleString("fr-FR")}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Fin</dt><dd className="mt-1 font-medium">{new Date(record.endDateTime).toLocaleString("fr-FR")}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Auditeur</dt><dd className="mt-1 font-medium">{record.auditeur}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Responsable</dt><dd className="mt-1 font-medium">{record.responsable.name}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Mode</dt><dd className="mt-1 font-medium">{record.missionMode === "ONLINE" ? "En ligne" : "Presentielle"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Statut</dt><dd className="mt-1"><Badge>{record.status}</Badge></dd></div>
          {record.location ? <div><dt className="text-xs text-muted-foreground">Lieu</dt><dd className="mt-1 font-medium">{record.location}</dd></div> : null}
          <div>
            <dt className="text-xs text-muted-foreground">Rappel responsable</dt>
            <dd className="mt-1 font-medium">{record.reminderSentAt ? `Envoye le ${new Date(record.reminderSentAt).toLocaleDateString("fr-FR")}` : "Pas encore envoye"}</dd>
          </div>
        </dl>
      </PagePanel>
    </PageStack>
  );
}
