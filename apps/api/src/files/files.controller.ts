import { Body, Controller, Delete, Get, Param, Post, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Roles } from "../auth/decorators/roles.decorator";
import { CsrfGuard } from "../auth/guards/csrf.guard";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { FilesService } from "./files.service";

@Controller()
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly service: FilesService) {}

  @Post("clients/:clientId/documents")
  @Roles("ADMIN", "RESPONSABLE")
  @UseGuards(CsrfGuard, RolesGuard)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 20 * 1024 * 1024, files: 1 } }))
  uploadClientDocument(
    @Param("clientId") clientId: string,
    @Body("type") type: unknown,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.uploadClientDocument({ clientId, file, type, userId: request.user.id });
  }

  @Delete("clients/:clientId/documents/:documentId")
  @Roles("ADMIN", "RESPONSABLE")
  @UseGuards(CsrfGuard, RolesGuard)
  removeClientDocument(
    @Param("clientId") clientId: string,
    @Param("documentId") documentId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.removeClientDocument({ clientId, documentId, userId: request.user.id });
  }

  @Get("files/:id/signed-url")
  createSignedDownloadUrl(@Param("id") id: string) {
    return this.service.createSignedDownloadUrl(id);
  }
}
