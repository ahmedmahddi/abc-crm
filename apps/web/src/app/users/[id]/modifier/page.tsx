import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, PageStack } from "@/components/layout/page-section";
import { UserEditForm } from "@/components/users/user-form";
import { ProtectedRoute } from "@/components/auth/role-gate";

export default async function EditUserPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return (
    <AppShell>
      <PageStack className="max-w-5xl">
        <Breadcrumbs items={[{ href: "/users", label: "Utilisateurs" }, { label: "Modifier" }]} />
        <PageHeader
          eyebrow="Administration"
          title="Modifier un utilisateur"
          description="Ajustez les droits, la liaison consultant, l'etat du compte ou le mot de passe."
        />
        <ProtectedRoute allowedRoles={["ADMIN"]}>
          <UserEditForm userId={id} />
        </ProtectedRoute>
      </PageStack>
    </AppShell>
  );
}
