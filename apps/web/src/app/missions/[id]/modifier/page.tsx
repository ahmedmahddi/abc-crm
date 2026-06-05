import { AppShell } from "@/components/layout/app-shell";
import { MissionEditForm } from "@/components/missions/mission-edit-form";
import { ProtectedRoute } from "@/components/auth/role-gate";

export default async function EditMissionPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl">
        <ProtectedRoute allowedRoles={["ADMIN", "RESPONSABLE"]}>
          <MissionEditForm missionId={id} />
        </ProtectedRoute>
      </div>
    </AppShell>
  );
}
