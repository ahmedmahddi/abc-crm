import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrdreMissionController } from "./ordre-mission.controller";
import { OrdreMissionService } from "./ordre-mission.service";

@Module({
  imports: [AuthModule],
  controllers: [OrdreMissionController],
  providers: [OrdreMissionService],
  exports: [OrdreMissionService],
})
export class OrdreMissionModule {}
