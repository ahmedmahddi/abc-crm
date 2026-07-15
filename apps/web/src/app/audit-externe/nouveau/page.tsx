import { AuditExterneCreateForm } from "@/components/audit-externe/audit-externe-create-form";
import { ProtectedRoute } from "@/components/auth/role-gate";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader, PageStack } from "@/components/layout/page-section";

export default function NewAuditExternePage() {
  return (
    <AppShell>
      <PageStack className="max-w-5xl">
        <Breadcrumbs items={[{ href: "/audit-externe", label: "Audit Externe" }, { label: "Planifier" }]} />
        <PageHeader eyebrow="Nouvel audit" title="Planifier un audit externe" description="Renseignez le client, l'organisme certificateur et le responsable a notifier." />
        <ProtectedRoute allowedRoles={["ADMIN", "RESPONSABLE"]}>
          <AuditExterneCreateForm />
        </ProtectedRoute>
      </PageStack>
    </AppShell>
  );
}
