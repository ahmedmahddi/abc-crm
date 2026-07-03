import { AuthShell } from "@/components/auth/auth-shell";
import { buttonVariants } from "@/components/ui/button";

export default function SessionExpiredPage() {
  return (
    <AuthShell
      eyebrow="Session expiree"
      title="Reconnectez-vous"
      description="Votre session n'est plus valide. Reconnectez-vous avec le meme compte avant de synchroniser les travaux en attente."
    >
      <div className="mt-8 flex flex-col gap-3">
        <p className="rounded-md border border-warning/30 bg-white px-3 py-3 text-sm text-muted-foreground" role="status">
          Les changements hors ligne restent conserves localement. La synchronisation reprendra apres authentification.
        </p>
        <a className={buttonVariants({ className: "w-full" })} href="/login?reason=session-expired">
          Se reconnecter
        </a>
      </div>
    </AuthShell>
  );
}
