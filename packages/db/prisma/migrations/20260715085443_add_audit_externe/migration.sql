-- CreateEnum
CREATE TYPE "AuditExterneType" AS ENUM ('CERTIFICATION', 'SUIVI_1', 'SUIVI_2');

-- CreateEnum
CREATE TYPE "AuditExterneReference" AS ENUM ('NORME_9001', 'QSE', 'NORME_22000', 'FSSC', 'BRC', 'BRC_IFS');

-- CreateTable
CREATE TABLE "AuditExterne" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "typeAudit" "AuditExterneType" NOT NULL,
    "reference" "AuditExterneReference" NOT NULL,
    "organisme" TEXT NOT NULL,
    "auditeur" TEXT NOT NULL,
    "responsableId" TEXT NOT NULL,
    "reminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AuditExterne_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuditExterne_missionId_key" ON "AuditExterne"("missionId");

-- CreateIndex
CREATE INDEX "AuditExterne_clientId_idx" ON "AuditExterne"("clientId");

-- CreateIndex
CREATE INDEX "AuditExterne_responsableId_idx" ON "AuditExterne"("responsableId");

-- CreateIndex
CREATE INDEX "AppNotification_userId_readAt_idx" ON "AppNotification"("userId", "readAt");

-- AddForeignKey
ALTER TABLE "AuditExterne" ADD CONSTRAINT "AuditExterne_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditExterne" ADD CONSTRAINT "AuditExterne_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditExterne" ADD CONSTRAINT "AuditExterne_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppNotification" ADD CONSTRAINT "AppNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
