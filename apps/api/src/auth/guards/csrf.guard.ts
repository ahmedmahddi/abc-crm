import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { Request } from "express";

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const cookieToken = request.cookies?.csrf_token as string | undefined;
    const headerToken = request.header("x-csrf-token");
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      throw new ForbiddenException("Jeton CSRF invalide");
    }
    return true;
  }
}
