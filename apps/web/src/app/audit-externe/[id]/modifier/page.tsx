import { AuditExterneEditForm } from "@/components/audit-externe/audit-externe-edit-form";
import { ProtectedRoute } from "@/components/auth/role-gate";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader, PageStack } from "@/components/layout/page-section";

export default async function EditAuditExternePage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return (
    <AppShell>
      <PageStack className="max-w-5xl">
        <Breadcrumbs items={[{ href: "/audit-externe", label: "Audit Externe" }, { label: "Modifier" }]} />
        <PageHeader eyebrow="Mise a jour" title="Modifier l'audit externe" />
        <ProtectedRoute allowedRoles={["ADMIN", "RESPONSABLE"]}>
          <AuditExterneEditForm id={id} />
        </ProtectedRoute>
      </PageStack>
    </AppShell>
  );
}
