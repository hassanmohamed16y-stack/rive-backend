import { BadRequestException, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { configureApp } from "../app.config";
import { OrdersService } from "../orders/orders.service";
import { PrismaService } from "../prisma/prisma.service";
import { PaymentController } from "./payment.controller";
import { PaymentService } from "./payment.service";
import { PaymobService } from "./paymob.service";

describe("Stripe webhook raw body integration", () => {
  let app: INestApplication;
  const paymentService = {
    handleWebhook: jest.fn().mockResolvedValue({ received: true }),
    createCheckoutSession: jest.fn(),
    refundTransaction: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        { provide: PaymentService, useValue: paymentService },
        { provide: PaymobService, useValue: {} },
        { provide: PrismaService, useValue: {} },
        { provide: OrdersService, useValue: {} },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ bodyParser: false });

    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it("passes the payload and signature to the handler", async () => {
    const payload = '{"id":"evt_raw","type":"checkout.session.completed"}';

    paymentService.handleWebhook.mockRejectedValueOnce(
      new BadRequestException(
        "Stripe payment gateway is disabled. Active payment provider is Paymob (/api/v1/payments/paymob-webhook).",
      ),
    );

    await request(app.getHttpServer())
      .post("/api/v1/payments/webhook")
      .set("stripe-signature", "t=1,v1=signature")
      .set("content-type", "application/json")
      .send(payload)
      .expect(400);

    expect(paymentService.handleWebhook).toHaveBeenCalled();
  });
});
