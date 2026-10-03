import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PermissionsGuard } from "../auth/permissions.guard";

describe("Admin Permissions Guard Enforcement Unit Tests", () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector);
  });

  const createMockContext = (user: any, requiredPermissions: string[] | null) => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(requiredPermissions);

    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  };

  it("full_admin user passes on every route regardless of permissions", () => {
    const fullAdminUser = {
      id: "admin-1",
      role: "ADMIN",
      roleName: "full_admin",
      permissions: [],
    };

    const routes = [
      ["products.edit"],
      ["orders.refund"],
      ["orders.update_status"],
      ["products.view"],
      ["settings.manage"],
      ["customers.view"],
      ["users.manage"],
      ["orders.view"],
    ];

    for (const requiredPerms of routes) {
      const context = createMockContext(fullAdminUser, requiredPerms);
      expect(guard.canActivate(context)).toBe(true);
    }
  });

  it("non-full_admin ADMIN without required permission gets 403 Forbidden", () => {
    const staffUser = {
      id: "staff-1",
      role: "ADMIN",
      roleName: "sales",
      permissions: ["orders.view", "customers.view"],
    };

    const forbiddenRoutes = [
      ["products.edit"],
      ["orders.refund"],
      ["settings.manage"],
      ["users.manage"],
      ["orders.update_status"],
    ];

    for (const requiredPerms of forbiddenRoutes) {
      const context = createMockContext(staffUser, requiredPerms);
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    }
  });

  it("non-full_admin ADMIN with required permission passes", () => {
    const salesUser = {
      id: "staff-1",
      role: "ADMIN",
      roleName: "sales",
      permissions: ["orders.view", "customers.view", "products.view"],
    };

    const allowedRoutes = [
      ["orders.view"],
      ["customers.view"],
      ["products.view"],
    ];

    for (const requiredPerms of allowedRoutes) {
      const context = createMockContext(salesUser, requiredPerms);
      expect(guard.canActivate(context)).toBe(true);
    }
  });

  it("public routes with no required permissions pass without error", () => {
    const contextWithoutUser = createMockContext(undefined, null);
    expect(guard.canActivate(contextWithoutUser)).toBe(true);

    const contextWithEmptyPerms = createMockContext(undefined, []);
    expect(guard.canActivate(contextWithEmptyPerms)).toBe(true);
  });
});
