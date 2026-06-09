import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { ClientsModule } from "./clients/clients.module";
import { ConsultantsModule } from "./consultants/consultants.module";
import { FilesModule } from "./files/files.module";
import { HealthModule } from "./health/health.module";
import { MissionsModule } from "./missions/missions.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PrismaModule } from "./prisma/prisma.module";
import { SyncModule } from "./sync/sync.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ["../../.env", ".env"] }),
    PrismaModule,
    HealthModule,
    AuthModule,
    ClientsModule,
    ConsultantsModule,
    FilesModule,
    MissionsModule,
    NotificationsModule,
    SyncModule,
    UsersModule,
  ],
})
export class AppModule {}
