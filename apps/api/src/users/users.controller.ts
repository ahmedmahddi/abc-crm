import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Roles } from "../auth/decorators/roles.decorator";
import { CsrfGuard } from "../auth/guards/csrf.guard";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { UsersService } from "./users.service";

@Controller("users")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  findMany(@Query() query: unknown) {
    return this.service.findMany(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @UseGuards(CsrfGuard)
  create(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.service.create(body, request.user.id);
  }

  @Patch(":id")
  @UseGuards(CsrfGuard)
  update(@Param("id") id: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.service.update(id, body, request.user.id);
  }

  @Post(":id/disable")
  @UseGuards(CsrfGuard)
  disable(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.service.disable(id, request.user.id);
  }

  @Post(":id/enable")
  @UseGuards(CsrfGuard)
  enable(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.service.enable(id, request.user.id);
  }

  @Post(":id/revoke-sessions")
  @UseGuards(CsrfGuard)
  revokeSessions(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.service.revokeSessions(id, request.user.id);
  }
}
