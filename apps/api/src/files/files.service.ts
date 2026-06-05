import { randomUUID } from "node:crypto";
import { BadGatewayException, BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient } from "@supabase/supabase-js";
import { CLIENT_DOCUMENT_TYPES, CLIENT_DOCUMENT_UPLOAD_RULES, type ClientDocumentType } from "@abc/shared";
import { z } from "zod";
import { PrismaService } from "../prisma/prisma.service";

const clientDocumentTypeSchema = z.enum(CLIENT_DOCUMENT_TYPES);

@Injectable()
export class FilesService {
  private readonly bucket: string;
  private readonly supabase;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.bucket = config.getOrThrow<string>("SUPABASE_STORAGE_BUCKET_PRIVATE");
    this.supabase = createClient(
      config.getOrThrow<string>("SUPABASE_URL"),
      config.getOrThrow<string>("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }

  async uploadClientDocument(input: {
    clientId: string;
    file: Express.Multer.File | undefined;
    type: unknown;
    userId: string;
  }) {
    const client = await this.prisma.client.findUnique({ where: { id: input.clientId }, select: { id: true } });
    if (!client) throw new NotFoundException("Client introuvable");
    const type = parseDocumentType(input.type);
    const file = validateFile(input.file, type);
    const storedName = `${randomUUID()}-${sanitizeFileName(file.originalname)}`;
    const path = `clients/${input.clientId}/${storedName}`;
    const { error } = await this.supabase.storage.from(this.bucket).upload(path, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });
    if (error) throw new BadGatewayException("Le stockage du document a échoué");

    try {
      const document = await this.prisma.$transaction(async (transaction) => {
        const createdFile = await transaction.file.create({
          data: {
            originalName: file.originalname,
            storedName,
            bucket: this.bucket,
            path,
            mimeType: file.mimetype,
            size: file.size,
            entityType: "CLIENT",
            entityId: input.clientId,
            uploadedById: input.userId,
          },
        });
        const createdDocument = await transaction.clientDocument.create({
          data: { clientId: input.clientId, fileId: createdFile.id, type },
          include: { file: { select: { id: true, originalName: true, mimeType: true, size: true, createdAt: true } } },
        });
        await transaction.activityLog.create({
          data: { userId: input.userId, action: "CLIENT_DOCUMENT_UPLOADED", entityType: "CLIENT", entityId: input.clientId },
        });
        return createdDocument;
      });
      return { data: document };
    } catch (error) {
      await this.supabase.storage.from(this.bucket).remove([path]);
      throw error;
    }
  }

  async removeClientDocument(input: { clientId: string; documentId: string; userId: string }) {
    const document = await this.prisma.clientDocument.findFirst({
      where: { id: input.documentId, clientId: input.clientId },
      include: { file: true },
    });
    if (!document) throw new NotFoundException("Document introuvable");

    const { error } = await this.supabase.storage.from(document.file.bucket).remove([document.file.path]);
    if (error) throw new BadGatewayException("La suppression du document a échoué");

    await this.prisma.$transaction(async (transaction) => {
      await transaction.clientDocument.delete({ where: { id: document.id } });
      await transaction.file.delete({ where: { id: document.fileId } });
      await transaction.activityLog.create({
        data: {
          userId: input.userId,
          action: "CLIENT_DOCUMENT_REMOVED",
          entityType: "CLIENT",
          entityId: input.clientId,
          description: `Document supprimé: ${document.file.originalName}`,
        },
      });
    });
    return { data: { id: document.id } };
  }

  async createSignedDownloadUrl(id: string) {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file) throw new NotFoundException("Document introuvable");
    const { data, error } = await this.supabase.storage.from(file.bucket).createSignedUrl(file.path, 60, {
      download: file.originalName,
    });
    if (error) throw new BadGatewayException("Le lien de téléchargement n'a pas pu être généré");
    return { data: { expiresInSeconds: 60, signedUrl: data.signedUrl } };
  }
}

function validateFile(file: Express.Multer.File | undefined, type: ClientDocumentType) {
  if (!file) throw new BadRequestException("Sélectionnez un document à importer");
  const rule = CLIENT_DOCUMENT_UPLOAD_RULES[type];
  if (file.size > rule.maxSizeBytes) throw new BadRequestException(`Le document dépasse la limite de ${rule.maxSizeLabel}`);
  if (!rule.mimeTypes.includes(file.mimetype)) {
    throw new BadRequestException(`Format non autorisé pour ${rule.label}. Utilisez ${rule.acceptedLabel}`);
  }
  return file;
}

function parseDocumentType(input: unknown) {
  const result = clientDocumentTypeSchema.safeParse(input);
  if (!result.success) throw new BadRequestException("Type de document invalide");
  return result.data;
}

function sanitizeFileName(name: string) {
  return name.normalize("NFKD").replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").toLowerCase();
}
