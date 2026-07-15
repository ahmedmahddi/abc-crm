import Link from "next/link";
import { RoleGate } from "@/components/auth/role-gate";
import { AuditExterneList } from "@/components/audit-externe/audit-externe-list";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, PageStack } from "@/components/layout/page-section";
import { Button } from "@/components/ui/button";

export default function AuditExternePage() {
  return (
    <AppShell>
      <PageStack>
        <PageHeader
          actions={
            <RoleGate allowedRoles={["ADMIN", "RESPONSABLE"]}>
              <Button asChild>
                <Link href="/audit-externe/nouveau">Planifier un audit</Link>
              </Button>
            </RoleGate>
          }
          eyebrow="Certification"
          title="Audit Externe"
          description="Planifiez et suivez les audits de certification et de suivi realises par les organismes externes."
        />
        <AuditExterneList />
      </PageStack>
    </AppShell>
  );
}
