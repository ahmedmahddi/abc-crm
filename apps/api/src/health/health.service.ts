import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { FilesService } from "../files/files.service";

type HealthCheck = { status: "ok" | "error" | "not_configured"; message?: string; bucket?: string };

@Injectable()
export class HealthService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
  ) {}

  async getHealth() {
    const [database, storage] = await Promise.all([this.checkDatabase(), this.files.checkStorageHealth()]);
    const redis: HealthCheck = this.config.get<string>("REDIS_URL")
      ? { status: "not_configured", message: "Redis health check is not wired in this deployment" }
      : { status: "not_configured" };
    const checks = { database, storage, redis };
    const status = database.status === "ok" && storage.status === "ok" ? "ok" : "degraded";

    return {
      status,
      service: "abc-crm-api",
      checkedAt: new Date().toISOString(),
      checks,
    };
  }

  private async checkDatabase(): Promise<HealthCheck> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "ok" };
    } catch (error) {
      return { status: "error", message: error instanceof Error ? error.message : "Database check failed" };
    }
  }
}
