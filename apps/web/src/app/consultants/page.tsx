import Link from "next/link";
import { ConsultantList } from "@/components/consultants/consultant-list";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, PageStack } from "@/components/layout/page-section";
import { Button } from "@/components/ui/button";

export default function ConsultantsPage() {
  return (
    <AppShell>
      <PageStack>
        <PageHeader
          actions={<Button asChild><Link href="/consultants/nouveau">Nouveau consultant</Link></Button>}
          eyebrow="Equipe terrain"
          title="Consultants"
          description="Profils operationnels distincts des comptes de connexion optionnels, avec charge et affectations visibles."
        />
        <ConsultantList />
      </PageStack>
    </AppShell>
  );
}
