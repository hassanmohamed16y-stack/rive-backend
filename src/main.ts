import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as bodyParser from 'body-parser';
import * as helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Apply Helmet middleware for HTTP security headers
  app.use(helmet.default());

  // Preserve raw body for Stripe webhook signature verification
  app.use((req, res, next) => {
    if (req.path === '/api/v1/payments/webhook') {
      let rawBody = '';
      req.on('data', (chunk) => {
        rawBody += chunk;
      });
      req.on('end', () => {
        (req as any).rawBody = rawBody;
        next();
      });
    } else {
      next();
    }
  });

  app.use(bodyParser.json());

  const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
  ].filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const isAllowed = allowedOrigins.includes(origin);

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error('CORS policy violation'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('RIVÉ Luxury Store API')
    .setDescription('Luxury e-commerce backend for the RIVÉ storefront')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('products')
    .addTag('categories')
    .addTag('orders')
    .addTag('auth')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
