import Link from "next/link";
import { RoleGate } from "@/components/auth/role-gate";
import { ConsultantList } from "@/components/consultants/consultant-list";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, PageStack } from "@/components/layout/page-section";
import { Button } from "@/components/ui/button";

export default function ConsultantsPage() {
  return (
    <AppShell>
      <PageStack>
        <PageHeader
          actions={<RoleGate allowedRoles={["ADMIN", "RESPONSABLE"]}><Button asChild><Link href="/consultants/nouveau">Nouveau consultant</Link></Button></RoleGate>}
          eyebrow="Equipe terrain"
          title="Consultants"
          description="Profils operationnels distincts des comptes de connexion optionnels, avec charge et affectations visibles."
        />
        <ConsultantList />
      </PageStack>
    </AppShell>
  );
}
