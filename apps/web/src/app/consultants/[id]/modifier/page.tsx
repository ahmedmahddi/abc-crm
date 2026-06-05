import { ConsultantEditLoader } from "@/components/consultants/consultant-edit-loader";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader, PageStack } from "@/components/layout/page-section";

export default async function EditConsultantPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return (
    <AppShell>
      <PageStack className="max-w-4xl">
        <Breadcrumbs items={[{ href: "/consultants", label: "Consultants" }, { label: "Modifier" }]} />
        <PageHeader
          eyebrow="Disponibilite"
          title="Modifier le consultant"
          description="Coordonnees metier et disponibilite pour les prochaines affectations."
        />
        <ConsultantEditLoader id={id} />
      </PageStack>
    </AppShell>
  );
}
