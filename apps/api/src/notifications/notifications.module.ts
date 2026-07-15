import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AppNotificationsController } from "./app-notifications.controller";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

@Module({
  imports: [AuthModule],
  controllers: [NotificationsController, AppNotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
