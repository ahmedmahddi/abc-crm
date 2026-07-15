import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { AUDIT_EXTERNE_REMINDER_MONTHS_BEFORE, AUDIT_EXTERNE_TYPE_LABELS } from "@abc/shared";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuditExterneReminderService {
  private readonly logger = new Logger(AuditExterneReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async runNightlySweep() {
    const dueRecords = await this.findDueRecords();
    for (const record of dueRecords) {
      await this.notifyAndMarkSent(record);
    }
    if (dueRecords.length > 0) {
      this.logger.log(`Sent ${dueRecords.length} audit externe reminder(s) via nightly sweep`);
    }
  }

  async checkAndNotifyIfDue(auditExterneId: string) {
    const record = await this.prisma.auditExterne.findUnique({
      where: { id: auditExterneId },
      include: reminderInclude,
    });
    if (!record) return;
    if (!this.isDue(record)) return;
    await this.notifyAndMarkSent(record);
  }

  private async findDueRecords() {
    const threshold = addMonths(new Date(), AUDIT_EXTERNE_REMINDER_MONTHS_BEFORE);
    return this.prisma.auditExterne.findMany({
      where: {
        reminderSentAt: null,
        mission: { archivedAt: null, status: "PLANNED", startDateTime: { lte: threshold } },
      },
      include: reminderInclude,
    });
  }

  private isDue(record: ReminderRecord) {
    if (record.reminderSentAt) return false;
    if (record.mission.archivedAt || record.mission.status !== "PLANNED") return false;
    const threshold = addMonths(new Date(), AUDIT_EXTERNE_REMINDER_MONTHS_BEFORE);
    return record.mission.startDateTime <= threshold;
  }

  private async notifyAndMarkSent(record: ReminderRecord) {
    const typeLabel = AUDIT_EXTERNE_TYPE_LABELS[record.typeAudit];
    const result = await this.notifications.notifyUser({
      userId: record.responsableId,
      type: "AUDIT_EXTERNE_REMINDER",
      title: "Audit externe a venir",
      body: `${record.client.companyName} - ${typeLabel} le ${record.mission.startDateTime.toLocaleDateString("fr-FR")}`,
      entityType: "AUDIT_EXTERNE",
      entityId: record.id,
      url: `/audit-externe/${record.id}`,
    });
    if (result.data.sent === 0) {
      this.logger.warn(`No push delivered for audit externe reminder ${record.id}; in-app notification still created`);
    }
    await this.prisma.auditExterne.update({ where: { id: record.id }, data: { reminderSentAt: new Date() } });
  }
}

const reminderInclude = {
  client: { select: { companyName: true } },
  mission: { select: { startDateTime: true, status: true, archivedAt: true } },
} as const;

type ReminderRecord = {
  id: string;
  responsableId: string;
  typeAudit: "CERTIFICATION" | "SUIVI_1" | "SUIVI_2";
  reminderSentAt: Date | null;
  client: { companyName: string };
  mission: { startDateTime: Date; status: string; archivedAt: Date | null };
};

function addMonths(date: Date, months: number) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}
