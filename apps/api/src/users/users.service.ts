import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@abc/db";
import { userCreateSchema, userListQuerySchema, userUpdateSchema, type UserUpdateInput } from "@abc/shared";
import * as argon2 from "argon2";
import { z } from "zod";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(query: unknown) {
    const { page, perPage, q, role, status } = parseInput(userListQuerySchema, query);
    const where: Prisma.UserWhereInput = {
      ...(role === "ALL" ? {} : { role }),
      ...(status === "ALL" ? {} : { status }),
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {}),
    };
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: userInclude,
        orderBy: { name: "asc" },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { data: users.map(toUserSummary), meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, include: userInclude });
    if (!user) throw new NotFoundException("Utilisateur introuvable");
    return { data: toUserSummary(user) };
  }

  async create(body: unknown, actorId: string) {
    const input = parseInput(userCreateSchema, body);
    try {
      const user = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.user.create({
          data: {
            name: input.name,
            email: input.email,
            passwordHash: await argon2.hash(input.password),
            role: input.role,
            ...(input.consultantId ? { consultant: { connect: { id: input.consultantId } } } : {}),
          },
          include: userInclude,
        });
        await transaction.activityLog.create({
          data: { userId: actorId, action: "USER_CREATED", entityType: "USER", entityId: created.id },
        });
        return created;
      });
      return { data: toUserSummary(user) };
    } catch (error) {
      handleKnownDatabaseError(error);
    }
  }

  async update(id: string, body: unknown, actorId: string) {
    const input = parseInput(userUpdateSchema, body);
    try {
      const user = await this.prisma.$transaction(async (transaction) => {
        const current = await transaction.user.findUnique({ where: { id } });
        if (!current) throw new NotFoundException("Utilisateur introuvable");
        if (id === actorId && input.status === "DISABLED") throw new ForbiddenException("Vous ne pouvez pas desactiver votre propre compte");

        const fields = await toUpdateData(input);
        const updated = await transaction.user.update({
          where: { id },
          data: {
            ...fields,
            ...(input.consultantId !== undefined
              ? input.consultantId
                ? { consultant: { connect: { id: input.consultantId } } }
                : { consultant: { disconnect: true } }
              : {}),
          },
          include: userInclude,
        });
        if (input.status === "DISABLED") {
          await transaction.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
        }
        await transaction.activityLog.create({
          data: { userId: actorId, action: "USER_UPDATED", entityType: "USER", entityId: id },
        });
        return updated;
      });
      return { data: toUserSummary(user) };
    } catch (error) {
      handleKnownDatabaseError(error);
    }
  }

  async disable(id: string, actorId: string) {
    return this.update(id, { status: "DISABLED" }, actorId);
  }

  async enable(id: string, actorId: string) {
    return this.update(id, { status: "ACTIVE" }, actorId);
  }

  async revokeSessions(id: string, actorId: string) {
    if (id === actorId) throw new ForbiddenException("Utilisez deconnexion pour fermer votre session courante");
    const current = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!current) throw new NotFoundException("Utilisateur introuvable");
    await this.prisma.$transaction([
      this.prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
      this.prisma.activityLog.create({ data: { userId: actorId, action: "USER_SESSIONS_REVOKED", entityType: "USER", entityId: id } }),
    ]);
    return { data: { ok: true } };
  }
}

const userInclude = {
  consultant: { select: { id: true, fullName: true, email: true } },
  sessions: { where: { revokedAt: null }, select: { id: true } },
} satisfies Prisma.UserInclude;

type UserWithRelations = Prisma.UserGetPayload<{ include: typeof userInclude }>;

async function toUpdateData(input: UserUpdateInput): Promise<Prisma.UserUpdateInput> {
  return {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.email !== undefined ? { email: input.email } : {}),
    ...(input.password ? { passwordHash: await argon2.hash(input.password) } : {}),
    ...(input.role !== undefined ? { role: input.role } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
  };
}

function toUserSummary(user: UserWithRelations) {
  const { passwordHash, sessions, ...fields } = user;
  void passwordHash;
  return { ...fields, activeSessionCount: sessions.length };
}

function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new BadRequestException({
    error: { code: "validation_error", message: "La requete contient des champs invalides", details: z.flattenError(result.error).fieldErrors },
  });
}

function handleKnownDatabaseError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new ConflictException("Un utilisateur ou un consultant utilise deja ces informations");
  }
  throw error;
}
