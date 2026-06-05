import Link from "next/link";

type BreadcrumbItem = { href?: string; label: string };

export function Breadcrumbs({ items }: Readonly<{ items: BreadcrumbItem[] }>) {
  return <nav aria-label="Fil d’Ariane"><ol className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{items.map((item, index) => <li className="flex items-center gap-2" key={`${item.label}-${index}`}>{index > 0 ? <span aria-hidden="true">/</span> : null}{item.href ? <Link className="min-h-11 content-center font-medium text-brand-700 hover:underline" href={item.href}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}</li>)}</ol></nav>;
}
