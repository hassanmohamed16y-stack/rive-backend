import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApp } from '../app.config';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

describe('Stripe webhook raw body integration', () => {
  let app: INestApplication;
  const paymentService = { handleWebhook: jest.fn().mockResolvedValue({ received: true }) };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [{ provide: PaymentService, useValue: paymentService }],
    }).compile();
    app = moduleRef.createNestApplication({ bodyParser: false });

    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('passes the exact unparsed JSON payload and Stripe signature to the handler', async () => {
    const payload = '{"id":"evt_raw","type":"checkout.session.completed"}';

    await request(app.getHttpServer())
      .post('/api/v1/payments/webhook')
      .set('stripe-signature', 't=1,v1=signature')
      .set('content-type', 'application/json')
      .send(payload)
      .expect(200);

    expect(paymentService.handleWebhook).toHaveBeenCalledWith(
      Buffer.from(payload),
      't=1,v1=signature',
    );
  });
});

describe('Stripe signed webhook HTTP integration', () => {
  let app: INestApplication;
  let paymentService: PaymentService;
  const transactionClient = {
    processedStripeEvent: { create: jest.fn().mockResolvedValue({ id: 'processed-event-1' }) },
    order: { findUnique: jest.fn().mockResolvedValue({ paymentSessionId: 'cs_http' }) },
  };
  const prisma = { $transaction: jest.fn((callback) => callback(transactionClient)) };
  const ordersService = {
    markPaidInTransaction: jest.fn().mockResolvedValue({ id: 'order-http', status: 'PAID' }),
    cancelPendingOrderInTransaction: jest.fn(),
  };

  beforeAll(async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_http_test';
    const moduleRef = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        PaymentService,
        { provide: PrismaService, useValue: prisma },
        { provide: OrdersService, useValue: ordersService },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ bodyParser: false });
    configureApp(app);
    await app.init();
    paymentService = moduleRef.get(PaymentService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts a Stripe SDK-signed raw request and marks the matching order paid', async () => {
    const payload = JSON.stringify({
      id: 'evt_http',
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_http',
          object: 'checkout.session',
          payment_status: 'paid',
          metadata: { orderId: 'order-http', orderNumber: 'RIV-HTTP' },
        },
      },
    });
    const signature = (paymentService as any).stripe.webhooks.generateTestHeaderString({
      payload,
      secret: 'whsec_http_test',
    });

    await request(app.getHttpServer())
      .post('/api/v1/payments/webhook')
      .set('stripe-signature', signature)
      .set('content-type', 'application/json')
      .send(payload)
      .expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ status: 'PAID', orderId: 'order-http' }));

    expect(ordersService.markPaidInTransaction).toHaveBeenCalledTimes(1);
  });
});