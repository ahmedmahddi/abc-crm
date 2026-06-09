import { createHash, randomBytes } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService, type JwtSignOptions } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { passwordResetConfirmSchema, passwordResetRequestSchema, type UserRole } from "@abc/shared";
import { z } from "zod";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";

const REFRESH_TOKEN_BYTES = 48;
const PASSWORD_RESET_TOKEN_BYTES = 32;
const PASSWORD_RESET_TTL_MINUTES = 30;
const LOGIN_THROTTLE_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_THROTTLE_MAX_FAILURES = Number(process.env.LOGIN_THROTTLE_MAX_FAILURES ?? "5");

const loginFailures = new Map<string, { count: number; firstFailedAt: number; lockedUntil?: number }>();

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  sessionId: string;
}

interface AccessTokenPayload {
  sub: string;
  sid: string;
  email: string;
  role: UserRole;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    assertLoginAllowed(email);

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      recordFailedLogin(email);
      throw new UnauthorizedException("Identifiants invalides");
    }
    if (user.status !== "ACTIVE") {
      throw new ForbiddenException("Ce compte est desactive. Contactez un administrateur.");
    }
    clearLoginFailures(email);

    const refreshToken = createOpaqueToken();
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: createRefreshExpiry(),
      },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      accessToken: await this.signAccessToken({
        sub: user.id,
        sid: session.id,
        email: user.email,
        role: user.role,
      }),
      refreshToken,
      csrfToken: createOpaqueToken(),
      user: toAuthenticatedUser(user, session.id),
    };
  }

  async refresh(refreshToken: string) {
    const session = await this.prisma.session.findFirst({
      where: {
        tokenHash: hashToken(refreshToken),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!session || session.user.status !== "ACTIVE") {
      throw new UnauthorizedException("Session expirée");
    }

    const nextRefreshToken = createOpaqueToken();
    await this.prisma.session.update({
      where: { id: session.id },
      data: { tokenHash: hashToken(nextRefreshToken), expiresAt: createRefreshExpiry() },
    });

    return {
      accessToken: await this.signAccessToken({
        sub: session.user.id,
        sid: session.id,
        email: session.user.email,
        role: session.user.role,
      }),
      refreshToken: nextRefreshToken,
      csrfToken: createOpaqueToken(),
      user: toAuthenticatedUser(session.user, session.id),
    };
  }

  async verifyAccessToken(accessToken: string): Promise<AuthenticatedUser> {
    const payload = await this.jwt.verifyAsync<AccessTokenPayload>(accessToken, {
      secret: getRequiredSecret("JWT_ACCESS_SECRET"),
    });
    const session = await this.prisma.session.findFirst({
      where: { id: payload.sid, userId: payload.sub, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true },
    });
    if (!session || session.user.status !== "ACTIVE") {
      throw new UnauthorizedException("Session invalide");
    }
    return toAuthenticatedUser(session.user, session.id);
  }

  async logout(sessionId: string) {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async requestPasswordReset(body: unknown) {
    const input = parseInput(passwordResetRequestSchema, body);
    const user = await this.prisma.user.findUnique({ where: { email: input.email.trim().toLowerCase() } });
    if (!user || user.status !== "ACTIVE") return { data: { ok: true } };

    const resetToken = createPasswordResetToken();
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(resetToken),
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000),
      },
    });

    if (process.env.NODE_ENV === "production") {
      await sendPasswordResetEmail(user.email, resetToken);
    }

    return {
      data: {
        ok: true,
        ...(process.env.NODE_ENV === "production" ? {} : { devResetToken: resetToken }),
      },
    };
  }

  async confirmPasswordReset(body: unknown) {
    const input = parseInput(passwordResetConfirmSchema, body);
    const reset = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash: hashToken(input.token),
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!reset) throw new BadRequestException("Lien de reinitialisation invalide ou expire");

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: reset.userId },
        data: { passwordHash: await argon2.hash(input.password) },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: reset.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.session.updateMany({
        where: { userId: reset.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { data: { ok: true } };
  }

  private signAccessToken(payload: AccessTokenPayload) {
    return this.jwt.signAsync(payload, {
      secret: getRequiredSecret("JWT_ACCESS_SECRET"),
      expiresIn: (process.env.ACCESS_TOKEN_TTL ?? "6d") as NonNullable<
        JwtSignOptions["expiresIn"]
      >,
    });
  }
}

function assertLoginAllowed(email: string) {
  const failure = loginFailures.get(email);
  if (!failure) return;
  const now = Date.now();
  if (failure.lockedUntil && failure.lockedUntil > now) {
    const retryAfterMinutes = Math.ceil((failure.lockedUntil - now) / 60_000);
    throw new HttpException(`Trop de tentatives. Reessayez dans ${retryAfterMinutes} min.`, HttpStatus.TOO_MANY_REQUESTS);
  }
  if (now - failure.firstFailedAt > LOGIN_THROTTLE_WINDOW_MS) {
    loginFailures.delete(email);
  }
}

function recordFailedLogin(email: string) {
  const now = Date.now();
  const current = loginFailures.get(email);
  const next =
    current && now - current.firstFailedAt <= LOGIN_THROTTLE_WINDOW_MS
      ? { ...current, count: current.count + 1 }
      : { count: 1, firstFailedAt: now };
  if (next.count >= LOGIN_THROTTLE_MAX_FAILURES) {
    next.lockedUntil = now + LOGIN_THROTTLE_WINDOW_MS;
  }
  loginFailures.set(email, next);
}

function clearLoginFailures(email: string) {
  loginFailures.delete(email);
}

async function sendPasswordResetEmail(email: string, token: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.PASSWORD_RESET_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new ServiceUnavailableException("Le service de reinitialisation du mot de passe n'est pas configure");
  }

  const appUrl = process.env.PASSWORD_RESET_BASE_URL ?? process.env.APP_URL ?? "http://localhost:3000";
  const resetUrl = `${appUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: "Reinitialisation de votre mot de passe ABC CRM",
      text: `Ouvrez ce lien pour reinitialiser votre mot de passe: ${resetUrl}`,
      html: `<p>Ouvrez ce lien pour reinitialiser votre mot de passe ABC CRM.</p><p><a href="${resetUrl}">Reinitialiser mon mot de passe</a></p><p>Ce lien expire dans ${PASSWORD_RESET_TTL_MINUTES} minutes.</p>`,
    }),
  });

  if (!response.ok) {
    throw new ServiceUnavailableException("L'email de reinitialisation n'a pas pu etre envoye");
  }
}

function createOpaqueToken() {
  return randomBytes(REFRESH_TOKEN_BYTES).toString("base64url");
}

function createPasswordResetToken() {
  return randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString("base64url");
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function createRefreshExpiry() {
  const refreshTokenTtlDays = Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? "6");
  return new Date(Date.now() + refreshTokenTtlDays * 24 * 60 * 60 * 1000);
}

function getRequiredSecret(name: "JWT_ACCESS_SECRET") {
  const secret = process.env[name];
  if (!secret) throw new Error(`${name} is required`);
  return secret;
}

function toAuthenticatedUser(
  user: { id: string; name: string; email: string; role: UserRole },
  sessionId: string,
): AuthenticatedUser {
  return { id: user.id, name: user.name, email: user.email, role: user.role, sessionId };
}

function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new BadRequestException({
    error: {
      code: "validation_error",
      message: "La requete contient des champs invalides",
      details: z.flattenError(result.error).fieldErrors,
    },
  });
}
