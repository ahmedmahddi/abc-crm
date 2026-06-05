import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { CsrfGuard } from "./guards/csrf.guard";
import { RolesGuard } from "./guards/roles.guard";

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, CsrfGuard, RolesGuard],
  exports: [AuthService, JwtAuthGuard, CsrfGuard, RolesGuard],
})
export class AuthModule {}
