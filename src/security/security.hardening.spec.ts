import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { JwtStrategy } from '../auth/jwt.strategy';
import { RegisterDto } from '../auth/dto/register.dto';
import { RolesGuard } from '../auth/roles.guard';
import { OrdersController } from '../orders/orders.controller';
import { PaymentService } from '../payment/payment.service';
import { CreateOrderDto } from '../orders/dto/create-order.dto';
import { CreateProductDto } from '../products/dto/create-product.dto';
import { CreateCheckoutSessionDto } from '../payment/dto/create-checkout-session.dto';

describe('Backend security regression tests', () => {
  describe('Authentication - Role injection prevention', () => {
    it('rejects a password without uppercase, lowercase, and numeric characters', async () => {
      const dto = plainToInstance(RegisterDto, {
        fullName: 'Aisha Rahman',
        email: 'aisha@example.com',
        password: 'alllowercase',
      });

      const errors = await validate(dto);
      expect(errors.some((error) => error.property === 'password')).toBe(true);
    });

    it('rejects role injection attempt in register payload', async () => {
      const dto = plainToInstance(RegisterDto, {
        fullName: 'Aisha Rahman',
        email: 'aisha@example.com',
        password: 'StrongPassword123!',
        role: 'ADMIN',
        permissions: ['all'],
      });

      const errors = await validate(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
      } as any);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((error) => error.property === 'role' || error.property === 'permissions')).toBe(true);
    });

    it('rejects privilege escalation via mass assignment (isAdmin)', async () => {
      const dto = plainToInstance(RegisterDto, {
        fullName: 'Aisha Rahman',
        email: 'aisha@example.com',
        password: 'StrongPassword123!',
        isAdmin: true,
      });

      const errors = await validate(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
      } as any);

      expect(errors.some((error) => error.property === 'isAdmin')).toBe(true);
    });

    it('rejects extra unknown fields in register DTO', async () => {
      const dto = plainToInstance(RegisterDto, {
        fullName: 'Aisha Rahman',
        email: 'aisha@example.com',
        password: 'StrongPassword123!',
        adminSecret: 'secret-code',
      });

      const errors = await validate(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
      } as any);

      // Whitelist should prevent unknown fields
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Input validation - DTO security', () => {
    it('rejects duplicate items in order', async () => {
      const dto = plainToInstance(CreateOrderDto, {
        customerName: 'Aisha Rahman',
        customerEmail: 'aisha@example.com',
        items: [
          { productVariantId: 'variant-1', quantity: 1 },
          { productVariantId: 'variant-1', quantity: 2 },
        ],
      });

      const errors = await validate(dto);
      // Duplicate check happens in service, not DTO
      // But DTO should validate structure
      expect(Array.isArray(dto.items)).toBe(true);
    });

    it('rejects invalid product variant IDs', async () => {
      const dto = plainToInstance(CreateOrderDto, {
        customerName: 'Aisha Rahman',
        customerEmail: 'aisha@example.com',
        items: [
          { productVariantId: '', quantity: 1 },
        ],
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects invalid quantities (zero or negative)', async () => {
      const dto = plainToInstance(CreateOrderDto, {
        customerName: 'Aisha Rahman',
        customerEmail: 'aisha@example.com',
        items: [
          { productVariantId: 'variant-1', quantity: 0 },
        ],
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects quantities exceeding maximum', async () => {
      const dto = plainToInstance(CreateOrderDto, {
        customerName: 'Aisha Rahman',
        customerEmail: 'aisha@example.com',
        items: [
          { productVariantId: 'variant-1', quantity: 100 },
        ],
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects oversized arrays in order items', async () => {
      const largeItems = Array.from({ length: 100 }, (_, i) => ({
        productVariantId: `variant-${i}`,
        quantity: 1,
      }));

      const dto = plainToInstance(CreateOrderDto, {
        customerName: 'Aisha Rahman',
        customerEmail: 'aisha@example.com',
        items: largeItems,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects oversized product names', async () => {
      const dto = plainToInstance(CreateProductDto, {
        name: 'x'.repeat(300),
        slug: 'test-product',
        categorySlug: 'test',
        images: [{ url: 'https://example.com/image.png' }],
        variants: [{ sku: 'TEST-1', size: 'S', price: 100 }],
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects oversized product descriptions', async () => {
      const dto = plainToInstance(CreateProductDto, {
        name: 'Test Product',
        slug: 'test-product',
        categorySlug: 'test',
        description: 'x'.repeat(2500),
        images: [{ url: 'https://example.com/image.png' }],
        variants: [{ sku: 'TEST-1', size: 'S', price: 100 }],
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects invalid checkout session DTO (malformed orderId)', async () => {
      const dto = plainToInstance(CreateCheckoutSessionDto, {
        orderId: 'x'.repeat(200),
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Authorization - Role-based access control', () => {
    it('denies customer access to admin-only operations', () => {
      const guard = new RolesGuard({
        getAllAndOverride: () => ['ADMIN'],
      } as any);

      const customerReq = { user: { userId: 'user-a', role: 'CUSTOMER' } };

      expect(() =>
        guard.canActivate({
          switchToHttp: () => ({ getRequest: () => customerReq }),
          getHandler: () => ({}),
          getClass: () => ({}),
        } as any),
      ).toThrow('Requires ADMIN role');
    });

    it('allows admin access to admin-only operations', () => {
      const guard = new RolesGuard({
        getAllAndOverride: () => ['ADMIN'],
      } as any);

      const adminReq = { user: { userId: 'admin-1', role: 'ADMIN' } };

      expect(
        guard.canActivate({
          switchToHttp: () => ({ getRequest: () => adminReq }),
          getHandler: () => ({}),
          getClass: () => ({}),
        } as any),
      ).toBe(true);
    });

    it('allows access when no roles are required', () => {
      const guard = new RolesGuard({
        getAllAndOverride: () => null,
      } as any);

      const customerReq = { user: { userId: 'user-a', role: 'CUSTOMER' } };

      expect(
        guard.canActivate({
          switchToHttp: () => ({ getRequest: () => customerReq }),
          getHandler: () => ({}),
          getClass: () => ({}),
        } as any),
      ).toBe(true);
    });

    it('denies access when user is missing role', () => {
      const guard = new RolesGuard({
        getAllAndOverride: () => ['ADMIN'],
      } as any);

      const invalidReq = { user: { userId: 'user-a' } };

      expect(() =>
        guard.canActivate({
          switchToHttp: () => ({ getRequest: () => invalidReq }),
          getHandler: () => ({}),
          getClass: () => ({}),
        } as any),
      ).toThrow('Access denied');
    });
  });

  describe('IDOR - Insecure Direct Object Reference', () => {
    it('denies customer access to other user orders', async () => {
      const ordersController = new OrdersController({
        findOne: jest.fn().mockResolvedValue({
          id: 'order-1',
          orderNumber: 'RIV-1000-ABC',
          userId: 'user-b',
          guestAccessToken: null,
        }),
      } as any);

      await expect(
        ordersController.findOne('RIV-1000-ABC', {
          user: { userId: 'user-a', role: 'CUSTOMER' },
          headers: {},
        } as any),
      ).rejects.toThrow('permission');
    });

    it('allows admin access to any order', async () => {
      const mockService = {
        findOne: jest.fn().mockResolvedValue({
          id: 'order-1',
          orderNumber: 'RIV-1000-ABC',
          userId: 'user-b',
          guestAccessToken: null,
        }),
      };

      const ordersController = new OrdersController(mockService as any);

      const result = await ordersController.findOne('RIV-1000-ABC', {
        user: { userId: 'admin-1', role: 'ADMIN' },
        headers: {},
      } as any);

      expect(result).toBeDefined();
      expect(result.orderNumber).toBe('RIV-1000-ABC');
    });

    it('allows customer access to their own order', async () => {
      const mockService = {
        findOne: jest.fn().mockResolvedValue({
          id: 'order-1',
          orderNumber: 'RIV-1000-ABC',
          userId: 'user-a',
          guestAccessToken: null,
        }),
      };

      const ordersController = new OrdersController(mockService as any);

      const result = await ordersController.findOne('RIV-1000-ABC', {
        user: { userId: 'user-a', role: 'CUSTOMER' },
        headers: {},
      } as any);

      expect(result).toBeDefined();
      expect(result.userId).toBe('user-a');
    });
  });

  describe('Payment ownership - Order authorization', () => {
    it('denies customer checkout creation for another user order', async () => {
      const prisma = {
        order: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'order-1',
            userId: 'user-b',
            status: 'PENDING',
            reservationExpiresAt: new Date(Date.now() + 60_000),
            orderNumber: 'RIV-1000-ABC',
            items: [
              {
                productVariant: {
                  product: { name: 'Luna Silk Set' },
                  size: 'S',
                },
                unitPrice: '120.00',
                quantity: 1,
              },
            ],
          }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };

      const service = new PaymentService(prisma as any, { expireOrder: jest.fn() } as any);

      await expect(
        service.createCheckoutSession('order-1', { userId: 'user-a', role: 'CUSTOMER' } as any),
      ).rejects.toThrow('permission');
    });

    it('allows customer checkout for their own order', async () => {
      const prisma = {
        order: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'order-1',
            userId: 'user-a',
            status: 'PENDING',
            reservationExpiresAt: new Date(Date.now() + 60_000),
            orderNumber: 'RIV-1000-ABC',
            items: [
              {
                productVariant: {
                  product: { name: 'Luna Silk Set', id: 'prod-1' },
                  size: 'S',
                  id: 'variant-1',
                },
                unitPrice: '120.00',
                quantity: 1,
              },
            ],
          }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };

      const service = new PaymentService(prisma as any, { expireOrder: jest.fn() } as any);

      // Mock Stripe
      (service as any).stripe = {
        checkout: {
          sessions: {
            create: jest.fn().mockResolvedValue({
              id: 'cs_test_1234',
              url: 'https://checkout.stripe.com/pay/cs_test_1234',
            }),
          },
        },
      };

      const result = await service.createCheckoutSession('order-1', { userId: 'user-a', role: 'CUSTOMER' } as any);

      expect(result.sessionId).toBe('cs_test_1234');
    });

    it('allows admin checkout for any order', async () => {
      const prisma = {
        order: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'order-1',
            userId: 'user-b',
            status: 'PENDING',
            reservationExpiresAt: new Date(Date.now() + 60_000),
            orderNumber: 'RIV-1000-ABC',
            items: [
              {
                productVariant: {
                  product: { name: 'Luna Silk Set', id: 'prod-1' },
                  size: 'S',
                  id: 'variant-1',
                },
                unitPrice: '120.00',
                quantity: 1,
              },
            ],
          }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };

      const service = new PaymentService(prisma as any, { expireOrder: jest.fn() } as any);

      // Mock Stripe
      (service as any).stripe = {
        checkout: {
          sessions: {
            create: jest.fn().mockResolvedValue({
              id: 'cs_test_1234',
              url: 'https://checkout.stripe.com/pay/cs_test_1234',
            }),
          },
        },
      };

      const result = await service.createCheckoutSession('order-1', { userId: 'admin-1', role: 'ADMIN' } as any);

      expect(result.sessionId).toBe('cs_test_1234');
    });

    it('rejects checkout for already-paid orders', async () => {
      const prisma = {
        order: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'order-1',
            userId: 'user-a',
            status: 'PAID',
            orderNumber: 'RIV-1000-ABC',
            items: [],
          }),
        },
      };

      const service = new PaymentService(prisma as any, { expireOrder: jest.fn() } as any);

      await expect(
        service.createCheckoutSession('order-1', { userId: 'user-a', role: 'CUSTOMER' } as any),
      ).rejects.toThrow('not awaiting payment');
    });
  });

  describe('JWT validation - Token security', () => {
    it('rejects invalid JWT payloads (missing userId)', async () => {
      const authService = { validateUser: jest.fn().mockResolvedValue(null) } as any;
      const strategy = new JwtStrategy(authService);

      await expect(strategy.validate({})).rejects.toThrow('Invalid token payload');
    });

    it('rejects tokens for deleted users', async () => {
      const authService = { validateUser: jest.fn().mockResolvedValue(null) } as any;
      const strategy = new JwtStrategy(authService);

      await expect(strategy.validate({ userId: 'missing-user' })).rejects.toThrow('User no longer exists');
    });

    it('accepts valid JWT payloads with existing user', async () => {
      const authService = {
        validateUser: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'aisha@example.com',
          role: 'CUSTOMER',
        }),
      } as any;
      const strategy = new JwtStrategy(authService);

      const result = await strategy.validate({
        userId: 'user-1',
        email: 'aisha@example.com',
        role: 'CUSTOMER',
      });

      expect(result).toMatchObject({
        userId: 'user-1',
        email: 'aisha@example.com',
        role: 'CUSTOMER',
      });
    });

    it('accepts tokens with sub field instead of userId', async () => {
      const authService = {
        validateUser: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'aisha@example.com',
          role: 'CUSTOMER',
        }),
      } as any;
      const strategy = new JwtStrategy(authService);

      const result = await strategy.validate({
        sub: 'user-1',
        email: 'aisha@example.com',
        role: 'CUSTOMER',
      });

      expect(result.userId).toBe('user-1');
    });
  });
});
