"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CLIENT_DOCUMENT_TYPES, CLIENT_DOCUMENT_UPLOAD_RULES, type ClientDocumentType } from "@abc/shared";
import { Download, FileText, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { apiFetch, apiUpload, ApiError } from "@/lib/api";
import { shouldQueueOffline } from "@/lib/offline/outbox";
import { stageClientDocumentUpload } from "@/lib/offline/uploads";

type ClientDocument = {
  id: string;
  type: ClientDocumentType;
  file: { id: string; originalName: string; mimeType: string; size: number };
};

export function ClientDocuments({ clientId, documents }: Readonly<{ clientId: string; documents: ClientDocument[] }>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [documentType, setDocumentType] = useState<ClientDocumentType>("OTHER");
  const [clientError, setClientError] = useState<string>();
  const [queuedMessage, setQueuedMessage] = useState<string>();
  const rule = CLIENT_DOCUMENT_UPLOAD_RULES[documentType];
  const upload = useMutation({
    mutationFn: async (file: File) => {
      validateSelectedFile(file, documentType);
      if (shouldQueueOffline()) {
        return stageClientDocumentUpload({ clientId, file, type: documentType });
      }

      const body = new FormData();
      body.append("file", file);
      body.append("type", documentType);
      return apiUpload(`/clients/${clientId}/documents`, body);
    },
    onMutate: () => {
      setClientError(undefined);
      setQueuedMessage(undefined);
    },
    onSuccess: async (result) => {
      if (inputRef.current) inputRef.current.value = "";
      if (result && typeof result === "object" && "encryptedBlob" in result) {
        setQueuedMessage("Document chiffre et ajoute au centre de synchronisation.");
      }
      await queryClient.invalidateQueries({ queryKey: ["clients", clientId] });
    },
  });

  function startUpload() {
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setClientError("Sélectionnez un fichier avant de lancer l'import.");
      return;
    }
    upload.mutate(file);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Documents client</CardTitle>
        <CardDescription>Justificatifs privés accessibles par lien temporaire.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-md border p-3">
          <Field>
            <FieldLabel htmlFor="documentType">Type de document</FieldLabel>
            <select className="h-11 rounded-md border bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" id="documentType" onChange={(event) => setDocumentType(event.target.value as ClientDocumentType)} value={documentType}>
              {CLIENT_DOCUMENT_TYPES.map((value) => <option key={value} value={value}>{CLIENT_DOCUMENT_UPLOAD_RULES[value].label}</option>)}
            </select>
          </Field>
          <Field>
            <FieldLabel htmlFor="clientDocument">Fichier</FieldLabel>
            <input accept={rule.accept} className="block min-h-11 w-full rounded-md border bg-white px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:font-medium" id="clientDocument" ref={inputRef} type="file" />
            <FieldDescription>Formats acceptés : {rule.acceptedLabel}. Taille maximale : {rule.maxSizeLabel}.</FieldDescription>
          </Field>
          {clientError ? <p className="text-sm text-danger" role="alert">{clientError}</p> : null}
          {upload.isError ? <p className="text-sm text-danger" role="alert">{upload.error instanceof ApiError ? upload.error.message : upload.error.message}</p> : null}
          {queuedMessage ? <p className="border-l-2 border-primary pl-3 text-sm" role="status">{queuedMessage}</p> : null}
          <Button disabled={upload.isPending} onClick={startUpload} type="button"><Upload data-icon="inline-start" />{upload.isPending ? "Transfert..." : "Importer le document"}</Button>
        </div>
        {documents.length === 0 ? <p className="text-sm text-muted-foreground">Aucun document importé.</p> : <ul className="flex flex-col gap-2">{documents.map((document) => <DocumentRow clientId={clientId} document={document} key={document.id} />)}</ul>}
      </CardContent>
    </Card>
  );
}

function DocumentRow({ clientId, document }: Readonly<{ clientId: string; document: ClientDocument }>) {
  const queryClient = useQueryClient();
  const download = useMutation({
    mutationFn: () => apiFetch<{ data: { signedUrl: string } }>(`/files/${document.file.id}/signed-url`),
    onSuccess: ({ data }) => { window.location.assign(data.signedUrl); },
  });
  const remove = useMutation({
    mutationFn: () => apiFetch(`/clients/${clientId}/documents/${document.id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["clients", clientId] });
    },
  });
  return (
    <li className="flex flex-col gap-2 rounded-md border px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <FileText className="size-4 shrink-0 text-brand-700" aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{document.file.originalName}</p>
            <p className="text-xs text-muted-foreground">{CLIENT_DOCUMENT_UPLOAD_RULES[document.type].label} · {formatFileSize(document.file.size)}</p>
          </div>
        </div>
        <div className="flex items-center">
          <Button aria-label={`Télécharger ${document.file.originalName}`} disabled={download.isPending} onClick={() => download.mutate()} size="sm" type="button" variant="ghost"><Download aria-hidden="true" /></Button>
          <Dialog>
            <DialogTrigger asChild><Button aria-label={`Retirer ${document.file.originalName}`} size="sm" type="button" variant="ghost"><Trash2 aria-hidden="true" /></Button></DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Retirer ce document ?</DialogTitle>
                <DialogDescription>Le fichier {document.file.originalName} sera retiré du dossier client et du stockage privé.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Conserver</Button></DialogClose>
                <DialogClose asChild><Button disabled={remove.isPending} onClick={() => remove.mutate()} variant="danger">{remove.isPending ? "Suppression..." : "Retirer le document"}</Button></DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      {remove.isError ? <p className="text-xs text-danger" role="alert">{remove.error instanceof ApiError ? remove.error.message : "Impossible de retirer ce document."}</p> : null}
      {download.isError ? <p className="text-xs text-danger" role="alert">{download.error instanceof ApiError ? download.error.message : "Impossible de télécharger ce document."}</p> : null}
    </li>
  );
}

function validateSelectedFile(file: File, type: ClientDocumentType) {
  const rule = CLIENT_DOCUMENT_UPLOAD_RULES[type];
  if (file.size > rule.maxSizeBytes) throw new Error(`Le document dépasse la limite de ${rule.maxSizeLabel}.`);
  if (!rule.mimeTypes.includes(file.type)) throw new Error(`Format non autorisé pour ${rule.label}. Utilisez ${rule.acceptedLabel}.`);
}

function formatFileSize(size: number) {
  return size < 1024 * 1024 ? `${Math.ceil(size / 1024)} Ko` : `${(size / 1024 / 1024).toFixed(1)} Mo`;
}
