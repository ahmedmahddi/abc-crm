import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { AuthService, type AuthenticatedUser } from "../auth.service";

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const accessToken = request.cookies?.access_token as string | undefined;
    if (!accessToken) throw new UnauthorizedException("Authentification requise");
    request.user = await this.authService.verifyAccessToken(accessToken);
    return true;
  }
}
