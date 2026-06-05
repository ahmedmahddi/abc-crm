import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { CsrfGuard } from "./guards/csrf.guard";
import { JwtAuthGuard, type AuthenticatedRequest } from "./guards/jwt-auth.guard";

const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.login(dto);
    setAuthCookies(response, result);
    return { data: { user: result.user } };
  }

  @Post("password-reset/request")
  @HttpCode(HttpStatus.OK)
  requestPasswordReset(@Body() body: unknown) {
    return this.authService.requestPasswordReset(body);
  }

  @Post("password-reset/confirm")
  @HttpCode(HttpStatus.OK)
  confirmPasswordReset(@Body() body: unknown) {
    return this.authService.confirmPasswordReset(body);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @UseGuards(CsrfGuard)
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const refreshToken = request.cookies?.refresh_token as string | undefined;
    if (!refreshToken) throw new UnauthorizedException("Refresh token manquant");
    const result = await this.authService.refresh(refreshToken);
    setAuthCookies(response, result);
    return { data: { user: result.user } };
  }

  @UseGuards(JwtAuthGuard, CsrfGuard)
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response) {
    await this.authService.logout(request.user.sessionId);
    clearAuthCookies(response);
    return { data: { ok: true } };
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@Req() request: AuthenticatedRequest) {
    return { data: { user: request.user } };
  }
}

function setAuthCookies(
  response: Response,
  result: { accessToken: string; refreshToken: string; csrfToken: string },
) {
  const secure = process.env.COOKIE_SECURE === "true";
  response.cookie("access_token", result.accessToken, cookieOptions(ACCESS_TOKEN_MAX_AGE_MS, secure));
  response.cookie("refresh_token", result.refreshToken, cookieOptions(REFRESH_TOKEN_MAX_AGE_MS, secure));
  response.cookie("csrf_token", result.csrfToken, {
    ...cookieOptions(REFRESH_TOKEN_MAX_AGE_MS, secure),
    httpOnly: false,
  });
}

function clearAuthCookies(response: Response) {
  response.clearCookie("access_token", { path: "/" });
  response.clearCookie("refresh_token", { path: "/" });
  response.clearCookie("csrf_token", { path: "/" });
}

function cookieOptions(maxAge: number, secure: boolean) {
  return { httpOnly: true, sameSite: "lax" as const, secure, maxAge, path: "/" };
}
