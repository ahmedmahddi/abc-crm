import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@abc/db";
import { pushSubscriptionSchema, pushUnsubscribeSchema } from "@abc/shared";
import webPush from "web-push";
import { z } from "zod";
import { PrismaService } from "../prisma/prisma.service";

type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {
    configureWebPush();
  }

  getPublicKey() {
    return { data: { enabled: isPushConfigured(), publicKey: process.env.VAPID_PUBLIC_KEY ?? null } };
  }

  async subscribe(body: unknown, userId: string, userAgent: string | undefined) {
    const input = parseInput(pushSubscriptionSchema, body);
    if (!isPushConfigured()) throw new BadRequestException("Les notifications push ne sont pas configurees");

    const subscription = await this.prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: {
        userId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: userAgent ?? null,
      },
      update: {
        userId,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: userAgent ?? null,
        lastSeenAt: new Date(),
        revokedAt: null,
      },
    });

    return { data: { id: subscription.id, enabled: true } };
  }

  async unsubscribe(body: unknown, userId: string) {
    const input = parseInput(pushUnsubscribeSchema, body);
    await this.prisma.pushSubscription.updateMany({
      where: { userId, endpoint: input.endpoint, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { data: { ok: true } };
  }

  async sendToUsers(userIds: string[], payload: PushPayload) {
    if (!isPushConfigured() || userIds.length === 0) return { data: { sent: 0, skipped: true } };

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId: { in: [...new Set(userIds)] }, revokedAt: null },
    });
    let sent = 0;
    let failed = 0;
    let revoked = 0;

    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webPush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { auth: subscription.auth, p256dh: subscription.p256dh },
            },
            JSON.stringify(payload),
          );
          sent += 1;
        } catch (error) {
          failed += 1;
          if (isExpiredSubscription(error)) {
            await this.prisma.pushSubscription.update({
              where: { id: subscription.id },
              data: { revokedAt: new Date() },
            });
            revoked += 1;
          }
        }
      }),
    );

    return { data: { failed, revoked, sent, skipped: false } };
  }
}

function configureWebPush() {
  if (!isPushConfigured()) return;
  webPush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:admin@example.com",
    process.env.VAPID_PUBLIC_KEY ?? "",
    process.env.VAPID_PRIVATE_KEY ?? "",
  );
}

function isPushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function isExpiredSubscription(error: unknown) {
  return (
    error instanceof Error &&
    "statusCode" in error &&
    typeof error.statusCode === "number" &&
    [404, 410].includes(error.statusCode)
  );
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
