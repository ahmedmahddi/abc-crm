import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Roles } from "../auth/decorators/roles.decorator";
import { CsrfGuard } from "../auth/guards/csrf.guard";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { MissionsService } from "./missions.service";

@Controller("missions")
@UseGuards(JwtAuthGuard)
export class MissionsController {
  constructor(private readonly service: MissionsService) {}

  @Get()
  findMany(@Query() query: unknown) {
    return this.service.findMany(query);
  }

  @Get("calendar")
  findCalendar(@Query() query: unknown) {
    return this.service.findCalendar(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles("ADMIN", "RESPONSABLE")
  @UseGuards(CsrfGuard, RolesGuard)
  create(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.service.create(body, request.user.id);
  }

  @Patch(":id")
  @Roles("ADMIN", "RESPONSABLE")
  @UseGuards(CsrfGuard, RolesGuard)
  update(@Param("id") id: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.service.update(id, body, request.user.id);
  }

  @Post(":id/cancel")
  @Roles("ADMIN", "RESPONSABLE")
  @UseGuards(CsrfGuard, RolesGuard)
  cancel(@Param("id") id: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.service.cancel(id, body, request.user.id);
  }

  @Post(":id/archive")
  @Roles("ADMIN", "RESPONSABLE")
  @UseGuards(CsrfGuard, RolesGuard)
  archive(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.service.archive(id, request.user.id);
  }
}
