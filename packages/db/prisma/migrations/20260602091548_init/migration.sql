-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'RESPONSABLE', 'CONSULTANT', 'VIEWER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ConsultantStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PersonnelType" AS ENUM ('CADRE', 'NON_CADRE');

-- CreateEnum
CREATE TYPE "PersonnelSource" AS ENUM ('MANUAL', 'ORGANIGRAMME_EXTRACTION');

-- CreateEnum
CREATE TYPE "FileEntityType" AS ENUM ('CLIENT', 'CONSULTANT', 'MISSION', 'ORDRE_MISSION', 'TEMPLATE', 'USER', 'OTHER');

-- CreateEnum
CREATE TYPE "ClientDocumentType" AS ENUM ('LOGO', 'RNE', 'PATENTE', 'ORGANIGRAMME', 'PERSONNEL_LIST', 'OTHER');

-- CreateEnum
CREATE TYPE "MissionType" AS ENUM ('AUDIT', 'FORMATION', 'ASSISTANCE');

-- CreateEnum
CREATE TYPE "MissionMode" AS ENUM ('ONLINE', 'PRESENTIELLE');

-- CreateEnum
CREATE TYPE "MissionStatus" AS ENUM ('PLANNED', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MissionConsultantRole" AS ENUM ('RESPONSABLE', 'PARTICIPANT');

-- CreateEnum
CREATE TYPE "OrdreMissionStatus" AS ENUM ('DRAFT', 'VALIDATED', 'PRINTED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SyncOperation" AS ENUM ('CREATE', 'UPDATE', 'ARCHIVE', 'RESTORE', 'DISABLE');

-- CreateEnum
CREATE TYPE "SyncMutationStatus" AS ENUM ('APPLIED', 'REJECTED', 'CONFLICT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CONSULTANT',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consultant" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT NOT NULL,
    "status" "ConsultantStatus" NOT NULL DEFAULT 'ACTIVE',
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Consultant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "fiscalNumber" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "zone" TEXT,
    "activitySector" TEXT NOT NULL,
    "applicationDomain" TEXT,
    "color" TEXT NOT NULL DEFAULT '#125885',
    "cadreCount" INTEGER NOT NULL DEFAULT 0,
    "nonCadreCount" INTEGER NOT NULL DEFAULT 0,
    "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientConsultant" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "consultantId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientConsultant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientPersonnel" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "position" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "type" "PersonnelType" NOT NULL,
    "source" "PersonnelSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientPersonnel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "File" (
    "id" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "entityType" "FileEntityType" NOT NULL,
    "entityId" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientDocument" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "type" "ClientDocumentType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "missionType" "MissionType" NOT NULL,
    "missionMode" "MissionMode" NOT NULL,
    "startDateTime" TIMESTAMP(3) NOT NULL,
    "endDateTime" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "description" TEXT,
    "status" "MissionStatus" NOT NULL DEFAULT 'PLANNED',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionConsultant" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "consultantId" TEXT NOT NULL,
    "role" "MissionConsultantRole" NOT NULL DEFAULT 'PARTICIPANT',

    CONSTRAINT "MissionConsultant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdreMission" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "missionId" TEXT,
    "clientId" TEXT NOT NULL,
    "missionType" "MissionType" NOT NULL,
    "missionMode" "MissionMode" NOT NULL,
    "startDateTime" TIMESTAMP(3) NOT NULL,
    "endDateTime" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "object" TEXT NOT NULL,
    "description" TEXT,
    "status" "OrdreMissionStatus" NOT NULL DEFAULT 'DRAFT',
    "templateId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "requiresReview" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "OrdreMission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdreMissionConsultant" (
    "id" TEXT NOT NULL,
    "ordreMissionId" TEXT NOT NULL,
    "consultantId" TEXT NOT NULL,

    CONSTRAINT "OrdreMissionConsultant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdreMissionTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contentHtml" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "OrdreMissionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdreMissionReferenceCounter" (
    "year" INTEGER NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrdreMissionReferenceCounter_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "SyncMutation" (
    "id" TEXT NOT NULL,
    "clientMutationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "operation" "SyncOperation" NOT NULL,
    "baseVersion" INTEGER,
    "status" "SyncMutationStatus" NOT NULL,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "SyncMutation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncConflict" (
    "id" TEXT NOT NULL,
    "clientMutationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "baseVersion" INTEGER NOT NULL,
    "serverVersion" INTEGER NOT NULL,
    "localPayload" JSONB NOT NULL,
    "serverPayload" JSONB NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncConflict_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Consultant_email_key" ON "Consultant"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Consultant_userId_key" ON "Consultant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Client_fiscalNumber_key" ON "Client"("fiscalNumber");

-- CreateIndex
CREATE INDEX "Client_companyName_idx" ON "Client"("companyName");

-- CreateIndex
CREATE INDEX "Client_activitySector_idx" ON "Client"("activitySector");

-- CreateIndex
CREATE INDEX "Client_status_idx" ON "Client"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ClientConsultant_clientId_consultantId_key" ON "ClientConsultant"("clientId", "consultantId");

-- CreateIndex
CREATE INDEX "ClientPersonnel_clientId_idx" ON "ClientPersonnel"("clientId");

-- CreateIndex
CREATE INDEX "File_entityType_entityId_idx" ON "File"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientDocument_clientId_type_fileId_key" ON "ClientDocument"("clientId", "type", "fileId");

-- CreateIndex
CREATE INDEX "Mission_clientId_idx" ON "Mission"("clientId");

-- CreateIndex
CREATE INDEX "Mission_startDateTime_idx" ON "Mission"("startDateTime");

-- CreateIndex
CREATE INDEX "Mission_status_idx" ON "Mission"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MissionConsultant_missionId_consultantId_key" ON "MissionConsultant"("missionId", "consultantId");

-- CreateIndex
CREATE UNIQUE INDEX "OrdreMission_reference_key" ON "OrdreMission"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "OrdreMission_missionId_key" ON "OrdreMission"("missionId");

-- CreateIndex
CREATE INDEX "OrdreMission_clientId_idx" ON "OrdreMission"("clientId");

-- CreateIndex
CREATE INDEX "OrdreMission_startDateTime_idx" ON "OrdreMission"("startDateTime");

-- CreateIndex
CREATE INDEX "OrdreMission_status_idx" ON "OrdreMission"("status");

-- CreateIndex
CREATE UNIQUE INDEX "OrdreMissionConsultant_ordreMissionId_consultantId_key" ON "OrdreMissionConsultant"("ordreMissionId", "consultantId");

-- CreateIndex
CREATE INDEX "ActivityLog_entityType_entityId_idx" ON "ActivityLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SyncMutation_clientMutationId_key" ON "SyncMutation"("clientMutationId");

-- CreateIndex
CREATE INDEX "SyncMutation_userId_createdAt_idx" ON "SyncMutation"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SyncMutation_entityType_entityId_idx" ON "SyncMutation"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncConflict_clientMutationId_key" ON "SyncConflict"("clientMutationId");

-- CreateIndex
CREATE INDEX "SyncConflict_userId_resolvedAt_idx" ON "SyncConflict"("userId", "resolvedAt");

-- CreateIndex
CREATE INDEX "SyncConflict_entityType_entityId_idx" ON "SyncConflict"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultant" ADD CONSTRAINT "Consultant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientConsultant" ADD CONSTRAINT "ClientConsultant_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientConsultant" ADD CONSTRAINT "ClientConsultant_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Consultant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPersonnel" ADD CONSTRAINT "ClientPersonnel_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientDocument" ADD CONSTRAINT "ClientDocument_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientDocument" ADD CONSTRAINT "ClientDocument_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionConsultant" ADD CONSTRAINT "MissionConsultant_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionConsultant" ADD CONSTRAINT "MissionConsultant_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Consultant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdreMission" ADD CONSTRAINT "OrdreMission_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdreMission" ADD CONSTRAINT "OrdreMission_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdreMission" ADD CONSTRAINT "OrdreMission_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "OrdreMissionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdreMission" ADD CONSTRAINT "OrdreMission_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdreMissionConsultant" ADD CONSTRAINT "OrdreMissionConsultant_ordreMissionId_fkey" FOREIGN KEY ("ordreMissionId") REFERENCES "OrdreMission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdreMissionConsultant" ADD CONSTRAINT "OrdreMissionConsultant_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Consultant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncMutation" ADD CONSTRAINT "SyncMutation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
