"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, type Resolver, type UseFormReturn } from "react-hook-form";
import { userCreateSchema, userUpdateSchema, type UserCreateInput, type UserUpdateInput } from "@abc/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiError } from "@/lib/api";

type ConsultantOption = { id: string; fullName: string; email: string };
type UserRole = "ADMIN" | "RESPONSABLE" | "CONSULTANT" | "VIEWER";
type UserStatus = "ACTIVE" | "DISABLED";
type UserFormValues = {
  consultantId: string;
  email: string;
  name: string;
  password: string;
  role: UserRole;
  status?: UserStatus;
};
type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  consultant: ConsultantOption | null;
};
type UserResponse = { data: User };

export function UserCreateForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const consultants = useConsultantOptions();
  const form = useForm<UserFormValues, unknown, UserFormValues>({
    defaultValues: { consultantId: "", email: "", name: "", password: "", role: "CONSULTANT" },
    resolver: zodResolver(userCreateSchema) as Resolver<UserFormValues>,
  });
  const mutation = useMutation({
    mutationFn: (input: UserCreateInput) => apiFetch<UserResponse>("/users", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: async ({ data }) => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      router.push(`/users/${data.id}/modifier`);
    },
  });

  return (
    <UserFormShell
      consultants={consultants.data?.data ?? []}
      consultantsError={consultants.isError}
      isPending={mutation.isPending}
      mutationError={mutation.error}
      onCancelHref="/users"
      onSubmit={(event) => void form.handleSubmit((values) => mutation.mutate(toCreatePayload(values)))(event)}
      submitLabel="Creer le compte"
    >
      <UserIdentityFields form={form} isEdit={false} />
      <UserAccessFields form={form} />
      <ConsultantLinkField consultants={consultants.data?.data ?? []} form={form} />
    </UserFormShell>
  );
}

export function UserEditForm({ userId }: Readonly<{ userId: string }>) {
  const user = useQuery({ queryKey: ["users", userId], queryFn: () => apiFetch<UserResponse>(`/users/${userId}`) });
  if (user.isPending) return <Skeleton className="h-96 border" />;
  if (user.isError) return <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">Impossible de charger cet utilisateur.</p>;
  return <LoadedUserEditForm user={user.data.data} />;
}

function LoadedUserEditForm({ user }: Readonly<{ user: User }>) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const consultants = useConsultantOptions();
  const form = useForm<UserFormValues, unknown, UserFormValues>({
    defaultValues: {
      consultantId: user.consultant?.id ?? "",
      email: user.email,
      name: user.name,
      password: "",
      role: user.role,
      status: user.status,
    },
    resolver: zodResolver(userUpdateSchema) as Resolver<UserFormValues>,
  });
  const mutation = useMutation({
    mutationFn: (input: UserUpdateInput) => apiFetch<UserResponse>(`/users/${user.id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["users"] }),
        queryClient.invalidateQueries({ queryKey: ["users", user.id] }),
      ]);
      router.push("/users");
    },
  });

  return (
    <UserFormShell
      consultants={consultants.data?.data ?? []}
      consultantsError={consultants.isError}
      isPending={mutation.isPending}
      mutationError={mutation.error}
      onCancelHref="/users"
      onSubmit={(event) => void form.handleSubmit((values) => mutation.mutate(toUpdatePayload(values)))(event)}
      submitLabel="Enregistrer"
    >
      <UserIdentityFields form={form} isEdit />
      <UserAccessFields form={form} />
      <ConsultantLinkField consultants={consultants.data?.data ?? []} form={form} />
    </UserFormShell>
  );
}

function useConsultantOptions() {
  return useQuery({
    queryKey: ["consultants", "user-link-options"],
    queryFn: () => apiFetch<{ data: ConsultantOption[] }>("/consultants?status=ACTIVE&page=1&perPage=100"),
  });
}

function UserFormShell({
  children,
  consultantsError,
  isPending,
  mutationError,
  onCancelHref,
  onSubmit,
  submitLabel,
}: Readonly<{
  children: React.ReactNode;
  consultants: ConsultantOption[];
  consultantsError: boolean;
  isPending: boolean;
  mutationError: unknown;
  onCancelHref: string;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  submitLabel: string;
}>) {
  return (
    <form className="flex flex-col gap-5" onSubmit={onSubmit}>
      {children}
      {consultantsError ? <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">Impossible de charger les consultants actifs.</p> : null}
      {mutationError ? (
        <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">
          {mutationError instanceof ApiError ? mutationError.message : "Impossible d'enregistrer ce compte."}
        </p>
      ) : null}
      <div className="sticky bottom-16 z-20 flex justify-end gap-3 rounded-lg border bg-white/95 p-3 shadow-md backdrop-blur lg:bottom-0">
        <Button asChild variant="outline"><Link href={onCancelHref}>Annuler</Link></Button>
        <Button disabled={isPending} type="submit">{isPending ? "Enregistrement..." : submitLabel}</Button>
      </div>
    </form>
  );
}

function UserIdentityFields({
  form,
  isEdit,
}: Readonly<{
  form: UseFormReturn<UserFormValues>;
  isEdit: boolean;
}>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Identite du compte</CardTitle>
        <CardDescription>Ces informations servent a la connexion et a l'audit des actions.</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field data-invalid={Boolean(form.formState.errors.name)}>
            <FieldLabel htmlFor="name">Nom complet</FieldLabel>
            <Input id="name" aria-invalid={Boolean(form.formState.errors.name)} {...form.register("name")} />
            {form.formState.errors.name ? <FieldError>Indiquez le nom de l'utilisateur.</FieldError> : null}
          </Field>
          <Field data-invalid={Boolean(form.formState.errors.email)}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input id="email" type="email" aria-invalid={Boolean(form.formState.errors.email)} {...form.register("email")} />
            {form.formState.errors.email ? <FieldError>Indiquez une adresse email valide.</FieldError> : null}
          </Field>
          <Field data-invalid={Boolean(form.formState.errors.password)}>
            <FieldLabel htmlFor="password">{isEdit ? "Nouveau mot de passe" : "Mot de passe"}</FieldLabel>
            <Input id="password" type="password" aria-invalid={Boolean(form.formState.errors.password)} {...form.register("password")} />
            <FieldDescription>{isEdit ? "Laissez vide pour conserver le mot de passe actuel." : "Minimum 10 caracteres."}</FieldDescription>
            {form.formState.errors.password ? <FieldError>Utilisez au moins 10 caracteres.</FieldError> : null}
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

function UserAccessFields({
  form,
}: Readonly<{
  form: UseFormReturn<UserFormValues>;
}>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Droits d'acces</CardTitle>
        <CardDescription>Les roles adaptent les actions visibles sans creer d'application separee.</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="role">Role</FieldLabel>
            <select className="h-11 rounded-md border bg-white px-3 text-sm" id="role" {...form.register("role")}>
              <option value="ADMIN">Admin</option>
              <option value="RESPONSABLE">Responsable</option>
              <option value="CONSULTANT">Consultant</option>
              <option value="VIEWER">Lecture seule</option>
            </select>
          </Field>
          {"status" in form.getValues() ? (
            <Field>
              <FieldLabel htmlFor="status">Etat</FieldLabel>
              <select className="h-11 rounded-md border bg-white px-3 text-sm" id="status" {...form.register("status")}>
                <option value="ACTIVE">Actif</option>
                <option value="DISABLED">Desactive</option>
              </select>
            </Field>
          ) : null}
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

function ConsultantLinkField({
  consultants,
  form,
}: Readonly<{
  consultants: ConsultantOption[];
  form: UseFormReturn<UserFormValues>;
}>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Liaison consultant</CardTitle>
        <CardDescription>Optionnel. Les profils consultants restent distincts des comptes de connexion.</CardDescription>
      </CardHeader>
      <CardContent>
        <Field>
          <FieldLabel htmlFor="consultantId">Profil consultant lie</FieldLabel>
          <select className="h-11 rounded-md border bg-white px-3 text-sm" id="consultantId" {...form.register("consultantId")}>
            <option value="">Aucun profil lie</option>
            {consultants.map((consultant) => (
              <option key={consultant.id} value={consultant.id}>
                {consultant.fullName} - {consultant.email}
              </option>
            ))}
          </select>
        </Field>
      </CardContent>
    </Card>
  );
}

function toCreatePayload(values: UserFormValues): UserCreateInput {
  return {
    consultantId: values.consultantId,
    email: values.email,
    name: values.name,
    password: values.password,
    role: values.role,
  };
}

function toUpdatePayload(values: UserFormValues): UserUpdateInput {
  return {
    consultantId: values.consultantId,
    email: values.email,
    name: values.name,
    password: values.password,
    role: values.role,
    status: values.status,
  };
}
