import { ProductsController } from "../products/products.controller";
import { CategoriesController } from "../categories/categories.controller";
import { CollectionsController } from "../collections/collections.controller";
import { BundlesController } from "../bundles/bundles.controller";
import { ShippingZonesController } from "../shipping-zones/shipping-zones.controller";
import { BannersController } from "../banners/banners.controller";
import { SiteSettingsController } from "../settings/site-settings.controller";
import { StaticPagesController } from "../static-pages/static-pages.controller";
import { SystemListsController } from "../system-lists/system-lists.controller";
import { ReviewsController } from "../reviews/reviews.controller";
import { AuthController } from "../auth/auth.controller";
import { OrdersController } from "../orders/orders.controller";
import { PaymentController } from "../payment/payment.controller";
import { CouponsController } from "../coupons/coupons.controller";

function getThrottlerLimit(target: any, name = "default"): number | undefined {
  return Reflect.getMetadata(`THROTTLER:LIMIT${name}`, target);
}

function getThrottlerTtl(target: any, name = "default"): number | undefined {
  return Reflect.getMetadata(`THROTTLER:TTL${name}`, target);
}

describe("Public Read Throttling Configuration", () => {
  const publicReadHandlers = [
    { target: ProductsController.prototype.findAll, name: "ProductsController.findAll" },
    { target: ProductsController.prototype.findOne, name: "ProductsController.findOne" },
    { target: CategoriesController.prototype.findAll, name: "CategoriesController.findAll" },
    { target: CollectionsController.prototype.findAll, name: "CollectionsController.findAll" },
    { target: CollectionsController.prototype.findOne, name: "CollectionsController.findOne" },
    { target: BundlesController.prototype.findAllPublic, name: "BundlesController.findAllPublic" },
    { target: BundlesController.prototype.findOne, name: "BundlesController.findOne" },
    { target: ShippingZonesController.prototype.findActive, name: "ShippingZonesController.findActive" },
    { target: BannersController.prototype.findActive, name: "BannersController.findActive" },
    { target: SiteSettingsController.prototype.getPublicSiteSettings, name: "SiteSettingsController.getPublicSiteSettings" },
    { target: StaticPagesController.prototype.findBySlug, name: "StaticPagesController.findBySlug" },
    { target: SystemListsController.prototype.findItems, name: "SystemListsController.findItems" },
    { target: ReviewsController.prototype.getApprovedReviews, name: "ReviewsController.getApprovedReviews" },
  ];

  it("applies @Throttle with default limit 120 to all public read routes", () => {
    for (const { target, name } of publicReadHandlers) {
      const limit = getThrottlerLimit(target);
      const ttl = getThrottlerTtl(target);

      expect(limit).toBe(120);
      expect(ttl).toBe(60000);
      expect(name).toBeTruthy();
    }
  });

  it("ensures sensitive endpoints rate limits remain unchanged", () => {
    // Reviews POST review endpoint should NOT have public read throttle limit (120)
    const createReviewLimit = getThrottlerLimit(ReviewsController.prototype.createReview);
    expect(createReviewLimit).toBeUndefined();

    // Coupons validate endpoint should NOT have public read throttle limit (120)
    const validateCouponLimit = getThrottlerLimit(CouponsController.prototype.validate);
    expect(validateCouponLimit).toBeUndefined();

    // Auth login limit should remain 5
    const loginLimit = getThrottlerLimit(AuthController.prototype.login);
    expect(loginLimit).toBe(5);

    // Orders create limit should remain 10
    const createOrderLimit = getThrottlerLimit(OrdersController.prototype.create);
    expect(createOrderLimit).toBe(10);

    // Payment checkout limit should remain 5
    const checkoutLimit = getThrottlerLimit(PaymentController.prototype.createCheckoutSession);
    expect(checkoutLimit).toBe(5);
  });
});
