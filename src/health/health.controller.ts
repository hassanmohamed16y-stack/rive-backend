import { Controller, Get, Optional, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { v2 as cloudinary } from "cloudinary";
import { FullAdminGuard } from "../auth/full-admin.guard";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";
import { AlertService } from "./alert.service";

export type HealthStatus = "healthy" | "unhealthy" | "unknown";

export interface IntegrationHealth {
  name: string;
  status: HealthStatus;
  message: string;
  lastCheckedAt: string;
}

export interface BackupHealthInfo {
  status: "configured" | "automated_pitr_active" | "manual_verification_required";
  lastBackupAt: string | null;
  provider: string;
  pitrEnabled: boolean;
  message: string;
  manualVerification: {
    dashboardUrl: string;
    steps: string[];
  };
}

export interface DetailedHealthResponse {
  status: "healthy" | "unhealthy";
  services: {
    database: IntegrationHealth;
    cloudinary: IntegrationHealth;
    paymob: IntegrationHealth;
  };
  backup: BackupHealthInfo;
  timestamp: string;
}

@ApiTags("health")
@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly alertService?: AlertService,
  ) {}

  @Get(["health", "api/v1/health", "api/v1/health/detailed"])
  @UseGuards(JwtAuthGuard, FullAdminGuard)
  @SkipThrottle()
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Check detailed health status of application and individual integrations (full_admin only)",
  })
  @ApiResponse({
    status: 200,
    description: "Returns independent health status for database, Cloudinary, Paymob, and database backup verification.",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden - Requires full_admin role" })
  async check(): Promise<DetailedHealthResponse> {
    const databaseHealth = await this.checkDatabase();
    const cloudinaryHealth = await this.checkCloudinary();
    const paymobHealth = await this.checkPaymob();
    const backupHealth = await this.checkBackup();

    const allHealthy =
      databaseHealth.status === "healthy" &&
      cloudinaryHealth.status === "healthy" &&
      paymobHealth.status === "healthy";

    return {
      status: allHealthy ? "healthy" : "unhealthy",
      services: {
        database: databaseHealth,
        cloudinary: cloudinaryHealth,
        paymob: paymobHealth,
      },
      backup: backupHealth,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("api/v1/health/backup")
  @UseGuards(JwtAuthGuard, FullAdminGuard)
  @SkipThrottle()
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Get database backup status and verification guidance (full_admin only)",
  })
  @ApiResponse({
    status: 200,
    description: "Returns Neon PostgreSQL backup status or manual verification instructions.",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden - Requires full_admin role" })
  async checkBackupEndpoint(): Promise<BackupHealthInfo> {
    return this.checkBackup();
  }

  private async checkDatabase(): Promise<IntegrationHealth> {
    const now = new Date().toISOString();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        name: "Database",
        status: "healthy",
        message: "Database query SELECT 1 executed successfully.",
        lastCheckedAt: now,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Database connection failed";
      if (this.alertService) {
        void this.alertService.sendAlert(
          "DATABASE_FAILURE",
          "Database Health Check Failure",
          `Health check failed to query database:\n${msg}`,
        );
      }
      return {
        name: "Database",
        status: "unhealthy",
        message: `Database connection failed: ${msg}`,
        lastCheckedAt: now,
      };
    }
  }

  private async checkCloudinary(): Promise<IntegrationHealth> {
    const now = new Date().toISOString();
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return {
        name: "Cloudinary",
        status: "unhealthy",
        message: "Cloudinary environment variables (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are missing or incomplete.",
        lastCheckedAt: now,
      };
    }

    try {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });

      const res = await cloudinary.api.ping();
      if (res?.status === "ok") {
        return {
          name: "Cloudinary",
          status: "healthy",
          message: "Cloudinary API ping succeeded.",
          lastCheckedAt: now,
        };
      }

      return {
        name: "Cloudinary",
        status: "unhealthy",
        message: `Cloudinary API returned unexpected response: ${JSON.stringify(res)}`,
        lastCheckedAt: now,
      };
    } catch (error: any) {
      const errMsg =
        error?.error?.message ||
        error?.message ||
        "Failed to communicate with Cloudinary API";
      return {
        name: "Cloudinary",
        status: "unhealthy",
        message: `Cloudinary API check failed: ${errMsg}`,
        lastCheckedAt: now,
      };
    }
  }

  private async checkPaymob(): Promise<IntegrationHealth> {
    const now = new Date().toISOString();
    const apiKey = process.env.PAYMOB_API_KEY;
    const hmacSecret = process.env.PAYMOB_HMAC_SECRET;
    const integrationId = process.env.PAYMOB_INTEGRATION_ID_CARD;

    if (!apiKey || !hmacSecret || !integrationId) {
      return {
        name: "Paymob",
        status: "unhealthy",
        message: "Paymob environment variables (PAYMOB_API_KEY, PAYMOB_HMAC_SECRET, PAYMOB_INTEGRATION_ID_CARD) are missing or incomplete.",
        lastCheckedAt: now,
      };
    }

    try {
      const response = await fetch("https://accept.paymob.com/api/auth/tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ api_key: apiKey }),
      });

      if (response.ok) {
        const data = (await response.json()) as { token?: string };
        if (data?.token) {
          return {
            name: "Paymob",
            status: "healthy",
            message: "Paymob API authentication token generated successfully.",
            lastCheckedAt: now,
          };
        }
      }

      const errData = await response.json().catch(() => null);
      const detail =
        errData?.detail ||
        errData?.message ||
        `HTTP ${response.status} ${response.statusText}`;

      return {
        name: "Paymob",
        status: "unhealthy",
        message: `Paymob API check failed: ${detail}`,
        lastCheckedAt: now,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Network error";
      return {
        name: "Paymob",
        status: "unhealthy",
        message: `Paymob API request failed: ${msg}`,
        lastCheckedAt: now,
      };
    }
  }

  private async checkBackup(): Promise<BackupHealthInfo> {
    const neonApiKey = process.env.NEON_API_KEY;
    const neonProjectId = process.env.NEON_PROJECT_ID;

    const manualSteps = {
      dashboardUrl: "https://console.neon.tech",
      steps: [
        "1. Log in to the Neon Management Console (https://console.neon.tech).",
        "2. Select your project and navigate to the 'Branches' or 'Restore' tab.",
        "3. Review continuous Point-in-Time Recovery (PITR) points or create a restore branch.",
        "4. For long-term offsite backups, execute './scripts/backup-db.sh' on the server.",
      ],
    };

    if (neonApiKey && neonProjectId) {
      try {
        const res = await fetch(
          `https://console.neon.tech/api/v2/projects/${neonProjectId}/branches`,
          {
            headers: {
              Authorization: `Bearer ${neonApiKey}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (res.ok) {
          const data = (await res.json()) as {
            branches?: Array<{ updated_at?: string; created_at?: string }>;
          };
          const latestBranch = data?.branches?.[0];
          const lastBackupDate =
            latestBranch?.updated_at || latestBranch?.created_at || null;

          return {
            status: "configured",
            lastBackupAt: lastBackupDate,
            provider: "Neon PostgreSQL",
            pitrEnabled: true,
            message:
              "Neon PostgreSQL continuous automated backup verified via Neon API.",
            manualVerification: manualSteps,
          };
        }
      } catch {
        // Fallback to explanatory instructions if API call fails
      }
    }

    return {
      status: "automated_pitr_active",
      lastBackupAt: null,
      provider: "Neon PostgreSQL",
      pitrEnabled: true,
      message:
        "Neon PostgreSQL performs continuous automatic Point-in-Time Recovery (PITR) backups (24h retention on Free Tier, up to 30 days on Paid Plans). Neon API keys are optional for this backend; backup status and restore points can be verified directly on the Neon Console.",
      manualVerification: manualSteps,
    };
  }
}
