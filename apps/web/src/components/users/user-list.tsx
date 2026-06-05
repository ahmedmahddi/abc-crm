"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Power, RotateCcw, Search, UserCog } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { FilterBar, FilterField, PagePanel, RecordList, SectionHeader } from "@/components/layout/page-section";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiError } from "@/lib/api";

type UserRole = "ADMIN" | "RESPONSABLE" | "CONSULTANT" | "VIEWER";
type UserStatus = "ACTIVE" | "DISABLED";
type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  lastLoginAt: string | null;
  activeSessionCount: number;
  consultant: { id: string; fullName: string; email: string } | null;
};
type UsersResponse = { data: User[]; meta: { total: number } };

export function UserList() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<UserRole | "ALL">("ALL");
  const [status, setStatus] = useState<UserStatus | "ALL">("ALL");
  const deferredSearch = useDeferredValue(search.trim());
  const users = useQuery({
    queryKey: ["users", deferredSearch, role, status],
    queryFn: () =>
      apiFetch<UsersResponse>(
        `/users?${new URLSearchParams({ q: deferredSearch, role, status, page: "1", perPage: "100" })}`,
      ),
  });
  const disable = useMutation({
    mutationFn: (id: string) => apiFetch(`/users/${id}/disable`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
  const enable = useMutation({
    mutationFn: (id: string) => apiFetch(`/users/${id}/enable`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
  const revokeSessions = useMutation({
    mutationFn: (id: string) => apiFetch(`/users/${id}/revoke-sessions`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
  const actionError = disable.error ?? enable.error ?? revokeSessions.error;
  const rows = users.data?.data ?? [];

  return (
    <PagePanel as="section" className="flex flex-col gap-4" aria-labelledby="user-list-title">
      <SectionHeader
        actions={
          <Button asChild size="sm">
            <Link href="/users/nouveau">Nouvel utilisateur</Link>
          </Button>
        }
        count={users.data ? `${users.data.meta.total} compte${users.data.meta.total > 1 ? "s" : ""}` : undefined}
        description="Comptes de connexion, roles, sessions actives et liaison consultant optionnelle."
        id="user-list-title"
        title="Comptes utilisateurs"
      />
      <FilterBar className="md:grid-cols-3">
        <FilterField className="relative">
          <span>Recherche</span>
          <Search className="pointer-events-none absolute left-3 top-9 size-4 text-muted-foreground" aria-hidden="true" />
          <Input className="pl-10" onChange={(event) => setSearch(event.target.value)} placeholder="Nom ou email" type="search" value={search} />
        </FilterField>
        <FilterSelect label="Role" onChange={(value) => setRole(value as UserRole | "ALL")} value={role}>
          <option value="ALL">Tous les roles</option>
          <option value="ADMIN">Admin</option>
          <option value="RESPONSABLE">Responsable</option>
          <option value="CONSULTANT">Consultant</option>
          <option value="VIEWER">Lecture seule</option>
        </FilterSelect>
        <FilterSelect label="Etat" onChange={(value) => setStatus(value as UserStatus | "ALL")} value={status}>
          <option value="ALL">Tous les etats</option>
          <option value="ACTIVE">Actifs</option>
          <option value="DISABLED">Desactives</option>
        </FilterSelect>
      </FilterBar>
      {actionError ? (
        <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">
          {actionError instanceof ApiError ? actionError.message : "Impossible de finaliser l'action demandee."}
        </p>
      ) : null}
      {users.isPending ? <UserListLoading /> : null}
      {users.isError ? <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">Impossible de charger les utilisateurs.</p> : null}
      {!users.isPending && !users.isError && rows.length === 0 ? <UserEmptyState /> : null}
      <RecordList>
        {rows.map((user) => (
          <UserRow
            isPending={disable.isPending || enable.isPending || revokeSessions.isPending}
            key={user.id}
            onDisable={() => disable.mutate(user.id)}
            onEnable={() => enable.mutate(user.id)}
            onRevokeSessions={() => revokeSessions.mutate(user.id)}
            user={user}
          />
        ))}
      </RecordList>
    </PagePanel>
  );
}

function UserRow({
  isPending,
  onDisable,
  onEnable,
  onRevokeSessions,
  user,
}: Readonly<{
  isPending: boolean;
  onDisable: () => void;
  onEnable: () => void;
  onRevokeSessions: () => void;
  user: User;
}>) {
  return (
    <article className="flex flex-col gap-3 rounded-md border bg-white p-4 shadow-soft md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-sm font-semibold">{user.name}</h3>
          <Badge>{user.role}</Badge>
          {user.status === "DISABLED" ? <Badge>Desactive</Badge> : null}
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">{user.email}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {user.consultant ? `Lie a ${user.consultant.fullName}` : "Aucun profil consultant lie"} - {user.activeSessionCount} session{user.activeSessionCount > 1 ? "s" : ""} active{user.activeSessionCount > 1 ? "s" : ""}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href={`/users/${user.id}/modifier`}>Modifier</Link>
        </Button>
        <RevokeSessionsDialog disabled={isPending || user.activeSessionCount === 0} onConfirm={onRevokeSessions} />
        {user.status === "DISABLED" ? (
          <Button disabled={isPending} onClick={onEnable} size="sm" type="button">
            <RotateCcw data-icon="inline-start" />
            Activer
          </Button>
        ) : (
          <DisableUserDialog disabled={isPending} onConfirm={onDisable} />
        )}
      </div>
    </article>
  );
}

function FilterSelect({
  children,
  label,
  onChange,
  value,
}: Readonly<{ children: React.ReactNode; label: string; onChange: (value: string) => void; value: string }>) {
  return (
    <FilterField>
      {label}
      <select
        className="h-11 rounded-md border bg-white px-3 text-sm font-medium normal-case tracking-normal text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {children}
      </select>
    </FilterField>
  );
}

function UserListLoading() {
  return (
    <div className="flex flex-col gap-2" aria-label="Chargement des utilisateurs" role="status">
      {[0, 1, 2].map((index) => (
        <Skeleton className="h-24 border" key={index} />
      ))}
    </div>
  );
}

function UserEmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-dashed px-4 py-10 text-center">
      <UserCog className="size-5 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-medium">Aucun utilisateur trouve</p>
      <p className="text-xs text-muted-foreground">Modifiez les filtres ou creez un nouveau compte.</p>
      <Button asChild size="sm">
        <Link href="/users/nouveau">Creer un utilisateur</Link>
      </Button>
    </div>
  );
}

function DisableUserDialog({ disabled, onConfirm }: Readonly<{ disabled: boolean; onConfirm: () => void }>) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button disabled={disabled} size="sm" type="button" variant="ghost">
          <Power data-icon="inline-start" />
          Desactiver
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Desactiver ce compte ?</DialogTitle>
          <DialogDescription>L'utilisateur sera deconnecte et ne pourra plus acceder au CRM.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Annuler</Button></DialogClose>
          <DialogClose asChild><Button onClick={onConfirm} variant="danger">Confirmer</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RevokeSessionsDialog({ disabled, onConfirm }: Readonly<{ disabled: boolean; onConfirm: () => void }>) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button disabled={disabled} size="sm" type="button" variant="outline">
          <KeyRound data-icon="inline-start" />
          Sessions
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revoquer les sessions ?</DialogTitle>
          <DialogDescription>L'utilisateur devra se reconnecter avant de continuer son travail.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Annuler</Button></DialogClose>
          <DialogClose asChild><Button onClick={onConfirm} variant="danger">Revoquer</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
