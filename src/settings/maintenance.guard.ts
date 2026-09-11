import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { SettingsService } from "./settings.service";

@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(private readonly settingsService: SettingsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const url = (request.originalUrl || request.url || request.path || "").toLowerCase();

    // Exempt admin routes, health check routes, API docs, and auth routes
    if (
      url.includes("/admin") ||
      url.includes("/health") ||
      url.includes("/api/docs") ||
      url.includes("/auth")
    ) {
      return true;
    }

    const { maintenanceMode } = await this.settingsService.getMaintenanceMode();

    if (maintenanceMode) {
      throw new ServiceUnavailableException("المتجر تحت الصيانة حاليًا");
    }

    return true;
  }
}
