import { ClientDetail } from "@/components/clients/client-detail";
import { AppShell } from "@/components/layout/app-shell";

export default async function ClientDetailPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return (
    <AppShell>
      <ClientDetail clientId={id} />
    </AppShell>
  );
}
