import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, PageStack } from "@/components/layout/page-section";
import { UserCreateForm } from "@/components/users/user-form";
import { ProtectedRoute } from "@/components/auth/role-gate";

export default function NewUserPage() {
  return (
    <AppShell>
      <PageStack className="max-w-5xl">
        <Breadcrumbs items={[{ href: "/users", label: "Utilisateurs" }, { label: "Nouveau" }]} />
        <PageHeader
          eyebrow="Administration"
          title="Creer un utilisateur"
          description="Ajoutez un compte de connexion et attribuez ses droits avant la premiere utilisation."
        />
        <ProtectedRoute allowedRoles={["ADMIN"]}>
          <UserCreateForm />
        </ProtectedRoute>
      </PageStack>
    </AppShell>
  );
}
