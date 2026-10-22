import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { verify } from "jsonwebtoken";
import { JWT_ALGORITHM, resolveJwtSecret } from "../auth/jwt-secret.util";
import { SettingsService } from "./settings.service";

@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(private readonly settingsService: SettingsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const url = (request.originalUrl || request.url || request.path || "").toLowerCase();

    // Exempt admin routes, health check routes, API docs, auth routes and internal
    // scheduler endpoints (cron jobs must keep running while the storefront is closed)
    if (
      url.includes("/admin") ||
      url.includes("/api/v1/internal/") ||
      url.includes("/health") ||
      url.includes("/api/docs") ||
      url.includes("/auth")
    ) {
      return true;
    }

    // Signed-in admins/staff keep full access so the dashboard works while the storefront is closed
    if (this.isStaffRequest(request)) {
      return true;
    }

    const { maintenanceMode } = await this.settingsService.getMaintenanceMode();

    if (maintenanceMode) {
      throw new ServiceUnavailableException("المتجر تحت الصيانة حاليًا");
    }

    return true;
  }

  private isStaffRequest(request: {
    headers?: Record<string, string | string[] | undefined>;
  }): boolean {
    const header = request.headers?.authorization;
    const value = Array.isArray(header) ? header[0] : header;
    if (!value || !/^Bearer\s+/i.test(value)) {
      return false;
    }
    try {
      const payload = verify(value.replace(/^Bearer\s+/i, "").trim(), resolveJwtSecret(), {
        algorithms: [JWT_ALGORITHM],
      }) as { role?: string; purpose?: string };
      return payload.role === "ADMIN" && (!payload.purpose || payload.purpose === "access");
    } catch {
      return false;
    }
  }
}
