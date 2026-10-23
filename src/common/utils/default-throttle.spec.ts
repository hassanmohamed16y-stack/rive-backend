import type { ExecutionContext } from "@nestjs/common";
import { CategoriesController } from "../../categories/categories.controller";
import { ShippingZonesController } from "../../shipping-zones/shipping-zones.controller";
import { SystemListsController } from "../../system-lists/system-lists.controller";
import {
  DEFAULT_THROTTLE_LIMIT,
  getAdminThrottleLimit,
  resolveDefaultThrottleLimit,
} from "./throttling";

function ctxFor(controller: any, method: string): ExecutionContext {
  return {
    getHandler: () => controller.prototype[method],
    getClass: () => controller,
  } as unknown as ExecutionContext;
}

describe("resolveDefaultThrottleLimit", () => {
  it("gives ADMIN-only routes the admin limit", () => {
    const admin = getAdminThrottleLimit();
    expect(
      resolveDefaultThrottleLimit(ctxFor(SystemListsController, "removeItem")),
    ).toBe(admin);
    expect(
      resolveDefaultThrottleLimit(ctxFor(CategoriesController, "remove")),
    ).toBe(admin);
    expect(
      resolveDefaultThrottleLimit(ctxFor(ShippingZonesController, "remove")),
    ).toBe(admin);
  });

  it("keeps the strict default for routes without an ADMIN role", () => {
    expect(
      resolveDefaultThrottleLimit(ctxFor(SystemListsController, "findItems")),
    ).toBe(DEFAULT_THROTTLE_LIMIT);
    expect(DEFAULT_THROTTLE_LIMIT).toBe(10);
  });

  it("never gives a class without roles metadata more than the default", () => {
    class Plain {
      handler() {}
    }
    expect(resolveDefaultThrottleLimit(ctxFor(Plain, "handler"))).toBe(
      DEFAULT_THROTTLE_LIMIT,
    );
  });
});
