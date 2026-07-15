import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { AuditExterneController } from "./audit-externe.controller";
import { AuditExterneReminderService } from "./audit-externe-reminder.service";
import { AuditExterneService } from "./audit-externe.service";

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [AuditExterneController],
  providers: [AuditExterneService, AuditExterneReminderService],
  exports: [AuditExterneService],
})
export class AuditExterneModule {}
