import { AppShell } from "@/components/layout/app-shell";
import { MissionDetail } from "@/components/missions/mission-detail";

export default async function MissionDetailPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return <AppShell><MissionDetail missionId={id} /></AppShell>;
}
