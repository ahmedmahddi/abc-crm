"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bold, Italic, List, ListOrdered } from "lucide-react";
import { TEMPLATE_PLACEHOLDERS, templateCreateSchema, templateUpdateSchema, type TemplateCreateInput, type TemplateUpdateInput } from "@abc/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiFetch, ApiError } from "@/lib/api";

type Template = { id: string; name: string; contentHtml: string; isDefault: boolean; version: number };

export function TemplateEditorForm({ template }: Readonly<{ template?: Template }>) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const editor = useEditor({ content: template?.contentHtml ?? "<p></p>", extensions: [StarterKit], immediatelyRender: false });
  const mutation = useMutation({
    mutationFn: async (body: TemplateCreateInput | TemplateUpdateInput) => template ? apiFetch(`/templates/${template.id}`, { method: "PATCH", body: JSON.stringify(body) }) : apiFetch("/templates", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["templates"] }); router.push("/templates"); },
  });
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = form.get("name");
    const input = { name: typeof name === "string" ? name : "", contentHtml: editor?.getHTML() ?? "", isDefault: form.get("isDefault") === "on", ...(template ? { version: template.version } : {}) };
    const result = template ? templateUpdateSchema.safeParse(input) : templateCreateSchema.safeParse(input);
    if (result.success) mutation.mutate(result.data);
  };
  const insertPlaceholder = (placeholder: string) => editor?.chain().focus().insertContent(placeholder).run();
  return <form className="flex flex-col gap-5" onSubmit={submit}><Card><CardHeader><CardTitle>Identification</CardTitle><CardDescription>Utilisez un nom explicite pour reconnaître le contexte d’usage.</CardDescription></CardHeader><CardContent><FieldGroup><Field><FieldLabel htmlFor="name">Nom du modèle *</FieldLabel><Input defaultValue={template?.name ?? ""} id="name" name="name" required /></Field><label className="flex min-h-11 items-center gap-3 text-sm"><input defaultChecked={template?.isDefault ?? false} className="size-4 accent-brand-700" name="isDefault" type="checkbox" />Utiliser par défaut pour les nouveaux ordres</label></FieldGroup></CardContent></Card><Card><CardHeader><CardTitle>Contenu de l’ordre</CardTitle><CardDescription>Insérez uniquement les variables approuvées. Le HTML est nettoyé côté serveur avant stockage.</CardDescription></CardHeader><CardContent className="flex flex-col gap-3"><div className="flex flex-wrap gap-2 border-b pb-3" aria-label="Mise en forme"><EditorButton label="Gras" onClick={() => editor?.chain().focus().toggleBold().run()}><Bold aria-hidden="true" /></EditorButton><EditorButton label="Italique" onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic aria-hidden="true" /></EditorButton><EditorButton label="Liste" onClick={() => editor?.chain().focus().toggleBulletList().run()}><List aria-hidden="true" /></EditorButton><EditorButton label="Liste numérotée" onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered aria-hidden="true" /></EditorButton></div><EditorContent className="min-h-72 rounded-md border bg-white p-3 text-sm [&_.tiptap]:min-h-64 [&_.tiptap]:outline-none" editor={editor} /><FieldDescription>Le document final remplacera les variables avec les données de la mission et du client.</FieldDescription></CardContent></Card><Card><CardHeader><CardTitle>Variables disponibles</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2">{TEMPLATE_PLACEHOLDERS.map((placeholder) => <Button key={placeholder} onClick={() => insertPlaceholder(placeholder)} size="sm" type="button" variant="outline">{placeholder}</Button>)}</CardContent></Card>{mutation.isError ? <FieldError>{mutation.error instanceof ApiError ? mutation.error.message : "Impossible d’enregistrer le modèle."}</FieldError> : null}<div className="sticky bottom-16 z-20 flex justify-end gap-3 rounded-lg border bg-white/95 p-3 shadow-md backdrop-blur lg:bottom-0"><Button asChild variant="outline"><Link href="/templates">Annuler</Link></Button><Button disabled={mutation.isPending} type="submit">{mutation.isPending ? "Enregistrement..." : "Enregistrer le modèle"}</Button></div></form>;
}

function EditorButton({ children, label, onClick }: Readonly<{ children: React.ReactNode; label: string; onClick: () => void }>) {
  return <Button aria-label={label} onClick={onClick} size="sm" type="button" variant="outline">{children}</Button>;
}

