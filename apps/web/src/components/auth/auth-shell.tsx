import Image from "next/image";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

type AuthShellProps = {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
};

const proofPoints = [
  "Acces protege par session",
  "Documents rattaches aux dossiers",
  "Planning terrain mobile-first",
];

export function AuthShell({ children, description, eyebrow, title }: Readonly<AuthShellProps>) {
  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,1fr)_34rem]">
      <section className="relative hidden overflow-hidden border-r bg-brand-900 px-12 py-16 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 opacity-30" aria-hidden="true">
          <div className="absolute left-10 top-20 h-56 w-56 rounded-full bg-brand-500 blur-3xl" />
          <div className="absolute bottom-10 right-8 h-72 w-72 rounded-full bg-brand-700 blur-3xl" />
        </div>
        <Link className="relative w-fit rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-100 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-900" href="/login">
          <Image src="/brand/abc-logo.webp" alt="ABC Consulting" width={180} height={68} priority style={{ height: "auto" }} />
        </Link>
        <div className="relative max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-200">Bureau d'etude</p>
          <h1 className="mt-3 font-display text-4xl font-semibold leading-4xl">Un CRM de mission, pas un tableau de bord generique.</h1>
          <p className="mt-4 max-w-lg text-sm leading-6 text-brand-100">Clients, consultants, documents et planning dans un espace concu pour le travail operationnel.</p>
          <div className="mt-8 grid gap-3 text-sm">
            {proofPoints.map((item) => (
              <p className="flex items-center gap-2" key={item}>
                <ShieldCheck className="size-4 text-brand-200" aria-hidden="true" />
                {item}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <Link className="inline-flex rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" href="/login">
            <Image src="/brand/abc-logo.webp" alt="ABC Consulting" width={158} height={58} priority style={{ height: "auto" }} />
          </Link>
          <div className="mt-10">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{eyebrow}</p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
