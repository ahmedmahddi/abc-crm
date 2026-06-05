export const CLIENT_DOCUMENT_TYPES = ["LOGO", "RNE", "PATENTE", "ORGANIGRAMME", "PERSONNEL_LIST", "OTHER"] as const;

export type ClientDocumentType = (typeof CLIENT_DOCUMENT_TYPES)[number];

type ClientDocumentUploadRule = {
  accept: string;
  acceptedLabel: string;
  label: string;
  maxSizeBytes: number;
  maxSizeLabel: string;
  mimeTypes: readonly string[];
};

const MEGABYTE = 1024 * 1024;

export const CLIENT_DOCUMENT_UPLOAD_RULES: Record<ClientDocumentType, ClientDocumentUploadRule> = {
  LOGO: { accept: ".jpg,.jpeg,.png", acceptedLabel: "JPG ou PNG", label: "Logo", maxSizeBytes: 2 * MEGABYTE, maxSizeLabel: "2 Mo", mimeTypes: ["image/jpeg", "image/png"] },
  RNE: { accept: ".pdf", acceptedLabel: "PDF", label: "RNE", maxSizeBytes: 10 * MEGABYTE, maxSizeLabel: "10 Mo", mimeTypes: ["application/pdf"] },
  PATENTE: { accept: ".pdf,.jpg,.jpeg,.png", acceptedLabel: "PDF, JPG ou PNG", label: "Patente / matricule fiscal", maxSizeBytes: 10 * MEGABYTE, maxSizeLabel: "10 Mo", mimeTypes: ["application/pdf", "image/jpeg", "image/png"] },
  ORGANIGRAMME: { accept: ".pdf,.jpg,.jpeg,.png", acceptedLabel: "PDF, JPG ou PNG", label: "Organigramme", maxSizeBytes: 20 * MEGABYTE, maxSizeLabel: "20 Mo", mimeTypes: ["application/pdf", "image/jpeg", "image/png"] },
  PERSONNEL_LIST: { accept: ".xlsx,.csv", acceptedLabel: "XLSX ou CSV", label: "Liste du personnel", maxSizeBytes: 10 * MEGABYTE, maxSizeLabel: "10 Mo", mimeTypes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/csv"] },
  OTHER: { accept: ".pdf,.jpg,.jpeg,.png,.xlsx,.csv", acceptedLabel: "PDF, JPG, PNG, XLSX ou CSV", label: "Autre document", maxSizeBytes: 10 * MEGABYTE, maxSizeLabel: "10 Mo", mimeTypes: ["application/pdf", "image/jpeg", "image/png", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/csv"] },
};
