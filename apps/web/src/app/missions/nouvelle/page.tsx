import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader, PageStack } from "@/components/layout/page-section";
import { MissionCreateForm } from "@/components/missions/mission-create-form";

export default function NewMissionPage() {
  return (
    <AppShell>
      <PageStack className="max-w-5xl">
        <Breadcrumbs items={[{ href: "/calendar", label: "Calendrier" }, { label: "Nouvelle mission" }]} />
        <PageHeader
          eyebrow="Planning terrain"
          title="Creer une mission"
          description="Preparez l'intervention terrain et affectez les consultants responsables."
        />
        <MissionCreateForm />
      </PageStack>
    </AppShell>
  );
}
