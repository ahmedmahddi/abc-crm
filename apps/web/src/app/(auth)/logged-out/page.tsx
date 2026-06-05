import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";

export default function LoggedOutPage() {
  return (
    <AuthShell
      eyebrow="Session fermee"
      title="Vous etes deconnecte"
      description="L'acces au CRM est protege. Reconnectez-vous pour reprendre vos dossiers, missions et documents."
    >
      <div className="mt-8 flex flex-col gap-3">
        <p className="rounded-md border bg-white px-3 py-3 text-sm text-muted-foreground" role="status">
          Les cookies de session ont ete retires de ce navigateur.
        </p>
        <Button asChild className="w-full"><Link href="/login">Retour a la connexion</Link></Button>
      </div>
    </AuthShell>
  );
}
