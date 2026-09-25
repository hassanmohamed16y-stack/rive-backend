import { Controller, Get, Optional, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { FullAdminGuard } from "../auth/full-admin.guard";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";
import { AlertService } from "./alert.service";

export interface IntegrationHealth {
  status: "ok" | "error";
  message?: string;
}

export interface DetailedHealthResponse {
  status: "ok" | "error";
  services: {
    database: IntegrationHealth;
    cloudinary: IntegrationHealth;
    paymob: IntegrationHealth;
  };
  timestamp: string;
}

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly alertService?: AlertService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, FullAdminGuard)
  @SkipThrottle()
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Check health status of application and external integrations (full_admin only)",
  })
  @ApiResponse({
    status: 200,
    description: "Returns health status of database, Cloudinary, and Paymob integrations.",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden - Requires full_admin role" })
  async check(): Promise<DetailedHealthResponse> {
    const databaseHealth = await this.checkDatabase();
    const cloudinaryHealth = this.checkCloudinary();
    const paymobHealth = this.checkPaymob();

    const allOk =
      databaseHealth.status === "ok" &&
      cloudinaryHealth.status === "ok" &&
      paymobHealth.status === "ok";

    return {
      status: allOk ? "ok" : "error",
      services: {
        database: databaseHealth,
        cloudinary: cloudinaryHealth,
        paymob: paymobHealth,
      },
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<IntegrationHealth> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "ok" };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Database connection failed";
      if (this.alertService) {
        void this.alertService.sendAlert(
          "DATABASE_FAILURE",
          "Database Health Check Failure",
          `Health check failed to query database:\n${msg}`,
        );
      }
      return { status: "error", message: msg };
    }
  }

  private checkCloudinary(): IntegrationHealth {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return {
        status: "error",
        message: "Cloudinary environment variables (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are missing or incomplete.",
      };
    }

    return { status: "ok" };
  }

  private checkPaymob(): IntegrationHealth {
    const apiKey = process.env.PAYMOB_API_KEY;
    const hmacSecret = process.env.PAYMOB_HMAC_SECRET;
    const integrationId = process.env.PAYMOB_INTEGRATION_ID_CARD;

    if (!apiKey || !hmacSecret || !integrationId) {
      return {
        status: "error",
        message: "Paymob environment variables (PAYMOB_API_KEY, PAYMOB_HMAC_SECRET, PAYMOB_INTEGRATION_ID_CARD) are missing or incomplete.",
      };
    }

    return { status: "ok" };
  }
}
