import { ConsultantCreateForm } from "@/components/consultants/consultant-create-form";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader, PageStack } from "@/components/layout/page-section";

export default function NewConsultantPage() {
  return (
    <AppShell>
      <PageStack className="max-w-4xl">
        <Breadcrumbs items={[{ href: "/consultants", label: "Consultants" }, { label: "Nouveau consultant" }]} />
        <PageHeader
          eyebrow="Profil metier"
          title="Creer un consultant"
          description="Le profil metier peut exister sans compte de connexion. L'acces applicatif sera gere separement."
        />
        <ConsultantCreateForm />
      </PageStack>
    </AppShell>
  );
}
