import { Body, Controller, Delete, Get, Post, Req, UseGuards } from "@nestjs/common";
import { CsrfGuard } from "../auth/guards/csrf.guard";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/guards/jwt-auth.guard";
import { NotificationsService } from "./notifications.service";

@Controller("notifications/push")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get("public-key")
  getPublicKey() {
    return this.service.getPublicKey();
  }

  @Post("subscriptions")
  @UseGuards(CsrfGuard)
  subscribe(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.service.subscribe(body, request.user.id, request.headers["user-agent"]);
  }

  @Delete("subscriptions")
  @UseGuards(CsrfGuard)
  unsubscribe(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.service.unsubscribe(body, request.user.id);
  }

  @Post("test")
  @UseGuards(CsrfGuard)
  sendTest(@Req() request: AuthenticatedRequest) {
    return this.service.sendToUsers([request.user.id], {
      title: "Notifications ABC CRM activees",
      body: "Vous recevrez les alertes liees a vos missions.",
      url: "/",
      tag: "abc-crm-test",
    });
  }
}
