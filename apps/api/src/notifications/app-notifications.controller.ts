import { Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/guards/jwt-auth.guard";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class AppNotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.service.listForUser(request.user.id);
  }

  @Post(":id/read")
  markRead(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.service.markRead(id, request.user.id);
  }
}
