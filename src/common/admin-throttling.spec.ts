import { AuditLogController } from "../audit-log/audit-log.controller";
import { AdminUsersController } from "../auth/admin-users.controller";
import { AutomationController } from "../automation/automation.controller";
import { AdminBundlesController } from "../bundles/admin-bundles.controller";
import { AdminCartSessionsController } from "../cart-sessions/admin-cart-sessions.controller";
import { AdminCollectionsController } from "../collections/admin-collections.controller";
import { AdminCouponsController } from "../coupons/admin-coupons.controller";
import { AdminCustomersController } from "../customers/admin-customers.controller";
import { AdminDataDeletionRequestsController } from "../customers/admin-data-deletion-requests.controller";
import { AdminDashboardController } from "../dashboard/admin-dashboard.controller";
import { ExpensesController } from "../expenses/expenses.controller";
import {
  OrdersExportController,
  CustomersExportController,
  PaymentsExportController,
} from "../export/export.controller";
import { AdminIntegrationsController } from "../integrations/admin-integrations.controller";
import { AdminMetaController } from "../integrations/admin-meta.controller";
import { ExcelController } from "../integrations/excel.controller";
import { InternalNotesController } from "../internal-notes/internal-notes.controller";
import { MessageTemplatesController } from "../message-templates/message-templates.controller";
import { AdminNotificationsController } from "../notifications/admin-notifications.controller";
import { AdminWhatsAppController } from "../notifications/admin-whatsapp.controller";
import { AdminOrdersController } from "../orders/admin-orders.controller";
import { AdminProductsController } from "../products/admin-products.controller";
import { AdminReviewsController } from "../reviews/admin-reviews.controller";
import { AdminSettingsController } from "../settings/admin-settings.controller";
import { SuppliersController } from "../suppliers/suppliers.controller";

import { AuthController } from "../auth/auth.controller";
import { OrdersController } from "../orders/orders.controller";
import { PaymentController } from "../payment/payment.controller";
import { CouponsController } from "../coupons/coupons.controller";
import { MetaController } from "../integrations/meta.controller";
import { WhatsAppController } from "../notifications/whatsapp.controller";
import { InternalOrdersController } from "../orders/internal-orders.controller";

function getThrottlerLimit(target: any, name = "default"): number | undefined {
  return Reflect.getMetadata(`THROTTLER:LIMIT${name}`, target);
}

function getThrottlerTtl(target: any, name = "default"): number | undefined {
  return Reflect.getMetadata(`THROTTLER:TTL${name}`, target);
}

describe("Admin Throttling Configuration", () => {
  const adminControllers = [
    { target: AuditLogController, name: "AuditLogController" },
    { target: AdminUsersController, name: "AdminUsersController" },
    { target: AutomationController, name: "AutomationController" },
    { target: AdminBundlesController, name: "AdminBundlesController" },
    { target: AdminCartSessionsController, name: "AdminCartSessionsController" },
    { target: AdminCollectionsController, name: "AdminCollectionsController" },
    { target: AdminCouponsController, name: "AdminCouponsController" },
    { target: AdminCustomersController, name: "AdminCustomersController" },
    { target: AdminDataDeletionRequestsController, name: "AdminDataDeletionRequestsController" },
    { target: AdminDashboardController, name: "AdminDashboardController" },
    { target: ExpensesController, name: "ExpensesController" },
    { target: OrdersExportController, name: "OrdersExportController" },
    { target: CustomersExportController, name: "CustomersExportController" },
    { target: PaymentsExportController, name: "PaymentsExportController" },
    { target: AdminIntegrationsController, name: "AdminIntegrationsController" },
    { target: AdminMetaController, name: "AdminMetaController" },
    { target: ExcelController, name: "ExcelController" },
    { target: InternalNotesController, name: "InternalNotesController" },
    { target: MessageTemplatesController, name: "MessageTemplatesController" },
    { target: AdminNotificationsController, name: "AdminNotificationsController" },
    { target: AdminWhatsAppController, name: "AdminWhatsAppController" },
    { target: AdminOrdersController, name: "AdminOrdersController" },
    { target: AdminProductsController, name: "AdminProductsController" },
    { target: AdminReviewsController, name: "AdminReviewsController" },
    { target: AdminSettingsController, name: "AdminSettingsController" },
    { target: SuppliersController, name: "SuppliersController" },
  ];

  it("applies controller-level @Throttle with limit 120 (from getAdminThrottleLimit) to all 26 admin controllers", () => {
    expect(adminControllers.length).toBe(26);

    for (const { target, name } of adminControllers) {
      const limit = getThrottlerLimit(target);
      const ttl = getThrottlerTtl(target);

      expect(limit).toBe(120);
      expect(ttl).toBe(60000);
      expect(name).toBeTruthy();
    }
  });

  it("ensures sensitive, auth, payment, coupon, webhook, and internal route limits remain unchanged", () => {
    // Auth login limit should remain 5
    const loginLimit = getThrottlerLimit(AuthController.prototype.login);
    expect(loginLimit).toBe(5);

    // Auth register limit should remain 5
    const registerLimit = getThrottlerLimit(AuthController.prototype.register);
    expect(registerLimit).toBe(5);

    // Orders create limit should remain 10
    const createOrderLimit = getThrottlerLimit(OrdersController.prototype.create);
    expect(createOrderLimit).toBe(10);

    // Payment checkout limit should remain 5
    const checkoutLimit = getThrottlerLimit(PaymentController.prototype.createCheckoutSession);
    expect(checkoutLimit).toBe(5);

    // Coupons validate endpoint should NOT have class/method level override limit (returns undefined)
    const validateCouponLimit = getThrottlerLimit(CouponsController.prototype.validate);
    expect(validateCouponLimit).toBeUndefined();

    // Webhooks should skip throttle or maintain custom limits
    const metaWebhookSkip = Reflect.getMetadata("THROTTLER:SKIPdefault", MetaController.prototype.handleWebhook);
    expect(metaWebhookSkip).toBe(true);

    const whatsappWebhookSkip = Reflect.getMetadata("THROTTLER:SKIPdefault", WhatsAppController.prototype.handleWebhook);
    expect(whatsappWebhookSkip).toBe(true);

    const paymobWebhookSkip = Reflect.getMetadata("THROTTLER:SKIPdefault", PaymentController.prototype.handlePaymobWebhook);
    expect(paymobWebhookSkip).toBe(true);

    // Internal orders expire reservations should remain 5
    const internalExpireReservationsLimit = getThrottlerLimit(InternalOrdersController.prototype.expireReservations);
    expect(internalExpireReservationsLimit).toBe(5);
  });
});
