import { Module } from "@nestjs/common";
import { SyncController } from "./sync.controller";
import { SyncService } from "./sync.service";
import { AuthModule } from "../auth/auth.module";
import { ClientsModule } from "../clients/clients.module";
import { ConsultantsModule } from "../consultants/consultants.module";
import { MissionsModule } from "../missions/missions.module";

@Module({
  imports: [AuthModule, ClientsModule, ConsultantsModule, MissionsModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
