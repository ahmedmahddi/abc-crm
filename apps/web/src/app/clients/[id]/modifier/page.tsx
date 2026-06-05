import { ClientEditForm } from "@/components/clients/client-edit-form";
import { ProtectedRoute } from "@/components/auth/role-gate";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader, PageStack } from "@/components/layout/page-section";

export default async function EditClientPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return (
    <AppShell>
      <PageStack className="max-w-5xl">
        <Breadcrumbs items={[{ href: "/clients", label: "Clients" }, { label: "Modifier" }]} />
        <PageHeader
          eyebrow="Mise a jour dossier"
          title="Modifier le client"
          description="Verifiez les reperes utilises par les consultants avant d'enregistrer."
        />
        <ProtectedRoute allowedRoles={["ADMIN", "RESPONSABLE"]}>
          <ClientEditForm clientId={id} />
        </ProtectedRoute>
      </PageStack>
    </AppShell>
  );
}
