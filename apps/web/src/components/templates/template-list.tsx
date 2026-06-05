"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, FileText, RotateCcw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FilterBar, FilterField, PagePanel, SectionHeader } from "@/components/layout/page-section";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiError } from "@/lib/api";

type TemplateStatus = "ACTIVE" | "ARCHIVED" | "ALL";
type Template = { id: string; name: string; isDefault: boolean; status: string; archivedAt: string | null; updatedAt: string };
type TemplateListResponse = { data: Template[]; meta: { total: number } };

const dateFormat = new Intl.DateTimeFormat("fr-FR");

export function TemplateList() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TemplateStatus>("ACTIVE");
  const deferredSearch = useDeferredValue(search.trim());
  const query = useQuery({
    queryKey: ["templates", deferredSearch, status],
    queryFn: () => apiFetch<TemplateListResponse>(`/templates?${new URLSearchParams({ q: deferredSearch, status, page: "1", perPage: "100" })}`),
  });
  const archive = useMutation({
    mutationFn: (id: string) => apiFetch(`/templates/${id}/archive`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates"] }),
  });
  const restore = useMutation({
    mutationFn: (id: string) => apiFetch(`/templates/${id}/restore`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates"] }),
  });
  const actionError = archive.error ?? restore.error;

  return (
    <PagePanel as="section" className="flex flex-col gap-4" aria-labelledby="template-list-title">
      <SectionHeader
        actions={<Button asChild size="sm"><Link href="/templates/nouveau">Nouveau modele</Link></Button>}
        count={query.data ? `${query.data.meta.total} modele${query.data.meta.total > 1 ? "s" : ""}` : undefined}
        description="Contenu approuve pour generer, archiver et restaurer les ordres de mission."
        id="template-list-title"
        title="Modeles d'ordre de mission"
      />

      <FilterBar>
        <FilterField className="relative">
          <span>Recherche</span>
          <Search className="pointer-events-none absolute left-3 top-9 size-4 text-muted-foreground" aria-hidden="true" />
          <Input className="pl-10" onChange={(event) => setSearch(event.target.value)} placeholder="Nom du modele" type="search" value={search} />
        </FilterField>
        <FilterField>
          Statut
          <select className="min-h-11 rounded-md border bg-white px-3 text-sm font-medium normal-case tracking-normal shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onChange={(event) => setStatus(event.target.value as TemplateStatus)} value={status}>
            <option value="ACTIVE">Actifs</option>
            <option value="ARCHIVED">Archives</option>
            <option value="ALL">Tous</option>
          </select>
        </FilterField>
      </FilterBar>

      {actionError ? <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">{actionError instanceof ApiError ? actionError.message : "Impossible de finaliser l'action demandee sur ce modele."}</p> : null}
      {query.isPending ? <div className="flex flex-col gap-2"><Skeleton className="h-20 border" /><Skeleton className="h-20 border" /></div> : null}
      {query.isError ? <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">Impossible de charger les modeles.</p> : null}
      {query.data?.data.length === 0 ? <TemplateEmptyState status={status} /> : null}
      {query.data?.data.length ? (
        <div className="flex flex-col divide-y rounded-md border bg-white">
          {query.data.data.map((template) => (
            <article className="flex min-h-16 flex-col gap-3 px-4 py-3 transition-colors hover:bg-brand-50/60 md:flex-row md:items-center md:justify-between" key={template.id}>
              <Link className="min-w-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`/templates/${template.id}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{template.name}</p>
                  {template.isDefault ? <Badge>Par defaut</Badge> : null}
                  {template.archivedAt ? <Badge>Archive</Badge> : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Mis a jour le {dateFormat.format(new Date(template.updatedAt))}</p>
              </Link>
              <div className="flex shrink-0 gap-2">
                {template.archivedAt ? (
                  <RestoreTemplateDialog isPending={restore.isPending} name={template.name} onConfirm={() => restore.mutate(template.id)} />
                ) : (
                  <ArchiveTemplateDialog disabled={template.isDefault} isPending={archive.isPending} name={template.name} onConfirm={() => archive.mutate(template.id)} />
                )}
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </PagePanel>
  );
}

function TemplateEmptyState({ status }: Readonly<{ status: TemplateStatus }>) {
  const message = status === "ARCHIVED" ? "Aucun modele archive." : "Aucun modele actif. Creez le contenu utilise pour les prochains ordres.";
  return (
    <div className="flex flex-col items-center gap-3 border border-dashed px-4 py-10 text-center">
      <FileText className="size-6 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{message}</p>
      {status !== "ARCHIVED" ? <Button asChild size="sm"><Link href="/templates/nouveau">Creer un modele</Link></Button> : null}
    </div>
  );
}

function ArchiveTemplateDialog({ disabled, isPending, name, onConfirm }: Readonly<{ disabled: boolean; isPending: boolean; name: string; onConfirm: () => void }>) {
  return (
    <Dialog>
      <DialogTrigger asChild><Button disabled={disabled} size="sm" variant="ghost" className="text-danger"><Archive data-icon="inline-start" />Archiver</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archiver ce modele ?</DialogTitle>
          <DialogDescription>{name} ne sera plus propose pour les nouveaux ordres. Les ordres existants ne sont pas modifies.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Annuler</Button></DialogClose>
          <DialogClose asChild><Button disabled={isPending} onClick={onConfirm} variant="danger">{isPending ? "Archivage..." : "Confirmer"}</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RestoreTemplateDialog({ isPending, name, onConfirm }: Readonly<{ isPending: boolean; name: string; onConfirm: () => void }>) {
  return (
    <Dialog>
      <DialogTrigger asChild><Button size="sm"><RotateCcw data-icon="inline-start" />Restaurer</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restaurer ce modele ?</DialogTitle>
          <DialogDescription>{name} redeviendra disponible dans le studio de modeles.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Annuler</Button></DialogClose>
          <DialogClose asChild><Button disabled={isPending} onClick={onConfirm}>{isPending ? "Restauration..." : "Confirmer"}</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
