"use client";

import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { TemplateEditorForm } from "./template-editor-form";
import { apiFetch } from "@/lib/api";

export function TemplateEditLoader({ templateId }: Readonly<{ templateId: string }>) {
  const query = useQuery({ queryKey: ["templates", templateId], queryFn: () => apiFetch<{ data: { id: string; name: string; contentHtml: string; isDefault: boolean; version: number } }>(`/templates/${templateId}`) });
  if (query.isPending) return <Skeleton className="h-96 border" />;
  if (query.isError) return <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">Impossible de charger ce modèle.</p>;
  return <TemplateEditorForm template={query.data.data} />;
}
