import Link from "next/link";
import { RoleGate } from "@/components/auth/role-gate";
import { ClientList } from "@/components/clients/client-list";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, PageStack } from "@/components/layout/page-section";
import { Button } from "@/components/ui/button";

export default function ClientsPage() {
  return (
    <AppShell>
      <PageStack>
        <PageHeader
          actions={<RoleGate allowedRoles={["ADMIN", "RESPONSABLE"]}><Button asChild><Link href="/clients/nouveau">Nouveau client</Link></Button></RoleGate>}
          eyebrow="Relation client"
          title="Clients"
          description="Accedez aux dossiers entreprise, aux contacts operationnels et aux documents requis pour preparer les missions."
        />
        <ClientList />
      </PageStack>
    </AppShell>
  );
}
