import { AppShell } from "@/components/layout/app-shell";
import { ProtectedRoute } from "@/components/auth/role-gate";
import { PageHeader, PageStack } from "@/components/layout/page-section";
import { UserList } from "@/components/users/user-list";

export default function UsersPage() {
  return (
    <AppShell>
      <PageStack>
        <PageHeader
          eyebrow="Administration"
          title="Utilisateurs"
          description="Gerez les comptes de connexion, les roles, les sessions actives et les liaisons consultants."
        />
        <ProtectedRoute allowedRoles={["ADMIN"]}>
          <UserList />
        </ProtectedRoute>
      </PageStack>
    </AppShell>
  );
}
