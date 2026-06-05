import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ConsultantsController } from "./consultants.controller";
import { ConsultantsService } from "./consultants.service";

@Module({
  imports: [AuthModule],
  controllers: [ConsultantsController],
  providers: [ConsultantsService],
  exports: [ConsultantsService],
})
export class ConsultantsModule {}
