import { AuditExterneDetail } from "@/components/audit-externe/audit-externe-detail";
import { AppShell } from "@/components/layout/app-shell";

export default async function AuditExterneDetailPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return (
    <AppShell>
      <AuditExterneDetail id={id} />
    </AppShell>
  );
}
