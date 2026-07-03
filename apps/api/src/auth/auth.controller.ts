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

const DEFAULT_ACCESS_TOKEN_TTL = "6d";
const DEFAULT_REFRESH_TOKEN_TTL_DAYS = 6;

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.login(dto);
    setAuthCookies(response, result);
    return { data: { csrfToken: result.csrfToken, user: result.user } };
  }

  @Get("clear-session")
  @Post("clear-session")
  @HttpCode(HttpStatus.OK)
  clearSession(@Res({ passthrough: true }) response: Response) {
    clearAuthCookies(response);
    return { data: { ok: true } };
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
    return { data: { csrfToken: result.csrfToken, user: result.user } };
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
  const sameSite = (process.env.COOKIE_SAME_SITE ?? "lax").toLowerCase() === "none" ? "none" : "lax";
  const accessTokenMaxAge = parseDurationMs(process.env.ACCESS_TOKEN_TTL ?? DEFAULT_ACCESS_TOKEN_TTL);
  const refreshTokenMaxAge = getRefreshTokenMaxAgeMs();
  response.cookie("access_token", result.accessToken, cookieOptions(accessTokenMaxAge, secure, sameSite));
  response.cookie("refresh_token", result.refreshToken, cookieOptions(refreshTokenMaxAge, secure, sameSite));
  response.cookie("csrf_token", result.csrfToken, {
    ...cookieOptions(refreshTokenMaxAge, secure, sameSite),
    httpOnly: false,
  });
}

function clearAuthCookies(response: Response) {
  const secure = process.env.COOKIE_SECURE === "true";
  const sameSite = (process.env.COOKIE_SAME_SITE ?? "lax").toLowerCase() === "none" ? "none" : "lax";
  const options = clearCookieOptions(secure, sameSite);
  response.clearCookie("access_token", options);
  response.clearCookie("refresh_token", options);
  response.clearCookie("csrf_token", options);
}

function cookieOptions(maxAge: number, secure: boolean, sameSite: "lax" | "none") {
  return { httpOnly: true, sameSite, secure, maxAge, path: "/" };
}

function clearCookieOptions(secure: boolean, sameSite: "lax" | "none") {
  return { sameSite, secure, path: "/" };
}

function getRefreshTokenMaxAgeMs() {
  const days = Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? DEFAULT_REFRESH_TOKEN_TTL_DAYS);
  const safeDays = Number.isFinite(days) && days > 0 ? days : DEFAULT_REFRESH_TOKEN_TTL_DAYS;
  return safeDays * 24 * 60 * 60 * 1000;
}

function parseDurationMs(value: string) {
  const trimmed = value.trim().toLowerCase();
  const match = /^(\d+)\s*(ms|s|m|h|d)?$/.exec(trimmed);
  if (!match) return parseDurationMs(DEFAULT_ACCESS_TOKEN_TTL);

  const amount = Number(match[1]);
  const unit = (match[2] ?? "s") as "ms" | "s" | "m" | "h" | "d";
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * (multipliers[unit] ?? 1000);
}
