import { createHash, randomBytes } from "node:crypto";
import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService, type JwtSignOptions } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { passwordResetConfirmSchema, passwordResetRequestSchema, type UserRole } from "@abc/shared";
import { z } from "zod";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";

const REFRESH_TOKEN_BYTES = 48;
const PASSWORD_RESET_TOKEN_BYTES = 32;
const PASSWORD_RESET_TTL_MINUTES = 30;

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
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || user.status !== "ACTIVE" || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException("Identifiants invalides");
    }

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
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user || user.status !== "ACTIVE") return { data: { ok: true } };

    const resetToken = createPasswordResetToken();
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(resetToken),
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000),
      },
    });

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
      expiresIn: (process.env.ACCESS_TOKEN_TTL ?? "15m") as NonNullable<
        JwtSignOptions["expiresIn"]
      >,
    });
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
  const refreshTokenTtlDays = Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? "30");
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
