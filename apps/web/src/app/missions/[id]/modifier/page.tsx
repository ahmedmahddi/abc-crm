import { AppShell } from "@/components/layout/app-shell";
import { MissionEditForm } from "@/components/missions/mission-edit-form";

export default async function EditMissionPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl">
        <MissionEditForm missionId={id} />
      </div>
    </AppShell>
  );
}
