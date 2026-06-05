import { ClientCreateForm } from "@/components/clients/client-create-form";
import { ProtectedRoute } from "@/components/auth/role-gate";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader, PageStack } from "@/components/layout/page-section";

export default function NewClientPage() {
  return (
    <AppShell>
      <PageStack className="max-w-5xl">
        <Breadcrumbs items={[{ href: "/clients", label: "Clients" }, { label: "Nouveau client" }]} />
        <PageHeader
          eyebrow="Nouveau dossier"
          title="Creer un client"
          description="Constituez le dossier initial : identite, responsables, contacts cadres et justificatifs. Vous pourrez le completer depuis la fiche client."
        />
        <ProtectedRoute allowedRoles={["ADMIN", "RESPONSABLE"]}>
          <ClientCreateForm />
        </ProtectedRoute>
      </PageStack>
    </AppShell>
  );
}
