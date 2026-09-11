import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { configureApp } from "../app.config";
import { OrdersService } from "../orders/orders.service";
import { PrismaService } from "../prisma/prisma.service";
import { PaymentController } from "./payment.controller";
import { PaymobService } from "./paymob.service";

describe("Paymob webhook raw & JSON body HTTP integration", () => {
  let app: INestApplication;
  const paymobService = {
    handleWebhook: jest.fn().mockResolvedValue({ received: true }),
    createCheckoutSession: jest.fn(),
    refundTransaction: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [{ provide: PaymobService, useValue: paymobService }],
    }).compile();
    app = moduleRef.createNestApplication({ bodyParser: false });

    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("passes callback payload and hmac query string to PaymobService", async () => {
    const payload = JSON.stringify({
      type: "TRANSACTION",
      obj: { id: 12345, special_reference: "order-e2e" },
    });

    await request(app.getHttpServer())
      .post("/api/v1/payments/paymob-webhook?hmac=test_hmac_signature")
      .set("content-type", "application/json")
      .send(payload)
      .expect(200);

    expect(paymobService.handleWebhook).toHaveBeenCalled();
  });
});

describe("Paymob signed webhook HTTP integration", () => {
  let app: INestApplication;
  let paymobService: PaymobService;
  const transactionClient = {
    processedPaymobEvent: {
      create: jest.fn().mockResolvedValue({ id: "processed-event-1" }),
    },
    order: {
      findUnique: jest.fn().mockResolvedValue({ paymentSessionId: "cs_http" }),
      update: jest.fn().mockResolvedValue({ id: "order-http", status: "PAID" }),
    },
  };
  const prisma = {
    $transaction: jest.fn((callback) => callback(transactionClient)),
    order: {
      update: jest.fn().mockResolvedValue({ id: "order-http", status: "PAID" }),
    },
  };
  const ordersService = {
    markPaidInTransaction: jest
      .fn()
      .mockResolvedValue({ id: "order-http", status: "PAID" }),
    cancelPendingOrderInTransaction: jest.fn(),
  };

  beforeAll(async () => {
    process.env.PAYMOB_HMAC_SECRET = "486CF40C8BEBD130F7CEF8CCFCF7BEBA";
    process.env.PAYMOB_INTEGRATION_ID_CARD = "5911535";
    const moduleRef = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        PaymobService,
        { provide: PrismaService, useValue: prisma },
        { provide: OrdersService, useValue: ordersService },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ bodyParser: false });
    configureApp(app);
    await app.init();
    paymobService = moduleRef.get(PaymobService);
  });

  afterAll(async () => {
    await app.close();
  });

  it("accepts a Paymob HMAC signed request and marks matching order paid", async () => {
    const payloadObject = {
      type: "TRANSACTION",
      obj: {
        id: 998877,
        pending: false,
        amount_cents: 12000,
        success: true,
        is_auth: false,
        is_capture: false,
        error_occured: false,
        is_standalone_payment: true,
        is_refunded: false,
        is_3d_secure: true,
        integration_id: 5911535,
        has_parent_transaction: false,
        order: { id: 112233 },
        created_at: "2026-09-11T00:00:00.000000",
        currency: "EGP",
        source_data: { pan: "2345", sub_type: "MasterCard", type: "card" },
        special_reference: "order-http",
      },
    };

    const signature = paymobService.calculateHmac(payloadObject);
    const rawPayload = JSON.stringify(payloadObject);

    await request(app.getHttpServer())
      .post(`/api/v1/payments/paymob-webhook?hmac=${signature}`)
      .set("content-type", "application/json")
      .send(rawPayload)
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({ status: "PAID", orderId: "order-http" }),
      );

    expect(ordersService.markPaidInTransaction).toHaveBeenCalledTimes(1);
  });
});
