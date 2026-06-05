import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res, StreamableFile, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { Roles } from "../auth/decorators/roles.decorator";
import { CsrfGuard } from "../auth/guards/csrf.guard";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { OrdreMissionService } from "./ordre-mission.service";

@Controller("ordres-mission")
@UseGuards(JwtAuthGuard)
export class OrdreMissionController {
  constructor(private readonly service: OrdreMissionService) {}

  @Get()
  findMany(@Query() query: unknown) {
    return this.service.findMany(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Get(":id/preview")
  async preview(@Param("id") id: string, @Res() response: Response) {
    response.type("text/html").send(await this.service.getPrintableHtml(id));
  }

  @Get(":id/export.csv")
  async exportCsv(@Param("id") id: string) {
    return toDownload(await this.service.exportCsv(id));
  }

  @Get(":id/export.xlsx")
  async exportXlsx(@Param("id") id: string) {
    return toDownload(await this.service.exportXlsx(id));
  }

  @Get(":id/export.pdf")
  async exportPdf(@Param("id") id: string) {
    return toDownload(await this.service.exportPdf(id));
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

  @Post(":id/archive")
  @Roles("ADMIN", "RESPONSABLE")
  @UseGuards(CsrfGuard, RolesGuard)
  archive(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.service.archive(id, request.user.id);
  }

  @Post(":id/validate")
  @Roles("ADMIN", "RESPONSABLE")
  @UseGuards(CsrfGuard, RolesGuard)
  validate(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.service.validate(id, request.user.id);
  }

  @Post(":id/mark-printed")
  @Roles("ADMIN", "RESPONSABLE")
  @UseGuards(CsrfGuard, RolesGuard)
  markPrinted(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.service.markPrinted(id, request.user.id);
  }

  @Post(":id/cancel")
  @Roles("ADMIN", "RESPONSABLE")
  @UseGuards(CsrfGuard, RolesGuard)
  cancel(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.service.cancel(id, request.user.id);
  }
}

function toDownload(file: { buffer: Buffer; filename: string; type: string }) {
  return new StreamableFile(file.buffer, { type: file.type, disposition: `attachment; filename="${file.filename}"` });
}
