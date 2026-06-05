import { ConsultantDetail } from "@/components/consultants/consultant-detail";
import { AppShell } from "@/components/layout/app-shell";

export default async function ConsultantDetailPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return <AppShell><ConsultantDetail id={id} /></AppShell>;
}
