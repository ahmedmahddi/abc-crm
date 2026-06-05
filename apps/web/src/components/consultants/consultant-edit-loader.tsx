"use client";

import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { ConsultantEditForm } from "./consultant-edit-form";

type Consultant = { id: string; fullName: string; email: string; phone?: string; status: "ACTIVE" | "INACTIVE" | "ARCHIVED"; version: number };

export function ConsultantEditLoader({ id }: Readonly<{ id: string }>) {
  const query = useQuery({ queryKey: ["consultants", id], queryFn: () => apiFetch<{ data: Consultant }>(`/consultants/${id}`) });
  if (query.isPending) return <Skeleton className="h-80" />;
  if (query.isError) return <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">Impossible de charger ce consultant.</p>;
  return <ConsultantEditForm consultant={query.data.data} />;
}
