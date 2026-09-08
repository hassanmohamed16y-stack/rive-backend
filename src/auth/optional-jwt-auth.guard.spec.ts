import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { OptionalJwtAuthGuard } from "./optional-jwt-auth.guard";

describe("OptionalJwtAuthGuard", () => {
  let guard: OptionalJwtAuthGuard;

  beforeEach(() => {
    guard = new OptionalJwtAuthGuard();
  });

  describe("canActivate", () => {
    it("returns true directly without calling Passport when no Authorization header is present", () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {},
          }),
        }),
      } as unknown as ExecutionContext;

      const superCanActivateSpy = jest.spyOn(
        Object.getPrototypeOf(OptionalJwtAuthGuard.prototype),
        "canActivate",
      );

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(superCanActivateSpy).not.toHaveBeenCalled();

      superCanActivateSpy.mockRestore();
    });

    it("delegates to super.canActivate when Authorization header is present", () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: "Bearer valid.jwt.token",
            },
          }),
        }),
      } as unknown as ExecutionContext;

      const superCanActivateSpy = jest
        .spyOn(
          Object.getPrototypeOf(OptionalJwtAuthGuard.prototype),
          "canActivate",
        )
        .mockReturnValue(true);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(superCanActivateSpy).toHaveBeenCalledWith(mockContext);

      superCanActivateSpy.mockRestore();
    });
  });

  describe("handleRequest", () => {
    it("returns user when user is present and no error occurred", () => {
      const user = {
        userId: "user-123",
        email: "user@example.com",
        role: "CUSTOMER",
      };

      const result = guard.handleRequest(
        null,
        user,
        null,
        {} as ExecutionContext,
      );

      expect(result).toBe(user);
    });

    it("throws custom error if provided to handleRequest", () => {
      const err = new UnauthorizedException("Jwt token expired");

      expect(() =>
        guard.handleRequest(err, false, null, {} as ExecutionContext),
      ).toThrow(err);
    });

    it("throws UnauthorizedException when user is missing/false and no error was provided (invalid token path)", () => {
      expect(() =>
        guard.handleRequest(null, false, null, {} as ExecutionContext),
      ).toThrow(UnauthorizedException);
      expect(() =>
        guard.handleRequest(null, null, null, {} as ExecutionContext),
      ).toThrow(UnauthorizedException);
    });
  });
});
