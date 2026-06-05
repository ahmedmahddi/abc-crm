import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { syncBatchSchema } from "@abc/shared";
import { CsrfGuard } from "../auth/guards/csrf.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/guards/jwt-auth.guard";
import { SyncService } from "./sync.service";

@Controller("sync")
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post("batch")
  @UseGuards(CsrfGuard)
  processBatch(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.syncService.processBatch(syncBatchSchema.parse(body), request.user.id);
  }
}
