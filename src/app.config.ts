import { ForbiddenException, INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as bodyParser from 'body-parser';
import * as express from 'express';
import helmet from 'helmet';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { requestLoggingMiddleware } from './common/middleware/request-logging.middleware';
import { isLocalOnlyEnvironment } from './common/utils/environment';

export function configureApp(app: INestApplication) {
  app.use(requestLoggingMiddleware);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: [`'self'`],
          imgSrc: [`'self'`, 'data:', 'https:'],
          scriptSrc: [`'self'`],
          objectSrc: [`'none'`],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: process.env.NODE_ENV === 'production',
    }),
  );

  app.use('/api/v1/payments/webhook', express.raw({ type: 'application/json' }));
  app.use(bodyParser.json({
    limit: '1mb',
    type: (request) => !request.url?.startsWith('/api/v1/payments/webhook'),
  }));

  const configuredOrigins = [
    process.env.FRONTEND_URL,
    process.env.ADMIN_FRONTEND_URL,
  ].filter(Boolean) as string[];
  const developmentOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
  ];
  const allowedOrigins = isLocalOnlyEnvironment()
    ? [...configuredOrigins, ...developmentOrigins]
    : configuredOrigins;

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new ForbiddenException('CORS policy violation'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Order-Access-Token'],
    maxAge: 86400,
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    forbidUnknownValues: true,
    stopAtFirstError: true,
    validationError: { value: false },
  }));
  app.useGlobalFilters(new HttpExceptionFilter());

  // JWT_SECRET presence outside local development/test is enforced at module-load time
  // in auth.module.ts / jwt.strategy.ts (the single source of truth for this check),
  // so no duplicate check is needed here.

  const config = new DocumentBuilder()
    .setTitle('RIVE Luxury Store API')
    .setDescription('Luxury e-commerce backend for the RIVE storefront')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('products')
    .addTag('categories')
    .addTag('orders')
    .addTag('auth')
    .addTag('internal')
    .addTag('health')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  if (isLocalOnlyEnvironment()) {
    SwaggerModule.setup('api/docs', app, document);
  }
}
