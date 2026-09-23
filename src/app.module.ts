import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuditLogModule } from "./audit-log/audit-log.module";
import { AuthModule } from "./auth/auth.module";
import { CategoriesModule } from "./categories/categories.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { CollectionsModule } from "./collections/collections.module";
import { EmailModule } from "./email/email.module";
import { HealthModule } from "./health/health.module";
import { IntegrationsModule } from "./integrations/integrations.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { OrdersModule } from "./orders/orders.module";
import { PaymentModule } from "./payment/payment.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ProductsModule } from "./products/products.module";
import { MaintenanceGuard } from "./settings/maintenance.guard";
import { SettingsModule } from "./settings/settings.module";
import { AutomationModule } from "./automation/automation.module";
import { ShippingZonesModule } from "./shipping-zones/shipping-zones.module";
import { SystemListsModule } from "./system-lists/system-lists.module";
import { UploadModule } from "./upload/upload.module";
import { BannersModule } from "./banners/banners.module";
import { MessageTemplatesModule } from "./message-templates/message-templates.module";
import { StaticPagesModule } from "./static-pages/static-pages.module";

@Module({
  imports: [
    BannersModule,
    MessageTemplatesModule,
    StaticPagesModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute in milliseconds
        limit: 10, // Default: 10 requests per minute
      },
    ]),
    PrismaModule,
    AuditLogModule,
    EmailModule,
    AuthModule,
    AutomationModule,
    CategoriesModule,
    DashboardModule,
    CollectionsModule,
    HealthModule,
    ProductsModule,
    PaymentModule,
    OrdersModule,
    UploadModule,
    SettingsModule,
    NotificationsModule,
    IntegrationsModule,
    SystemListsModule,
    ShippingZonesModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: MaintenanceGuard,
    },
  ],
})
export class AppModule {}
