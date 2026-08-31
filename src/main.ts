import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'https://*.vercel.app',
    'https://*.netlify.app',
    'https://*.bolt.new',
    'https://*.localhost',
  ].filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const isAllowed =
        allowedOrigins.some((allowedOrigin) => {
          if (!allowedOrigin) return false;
          if (allowedOrigin.includes('*')) {
            const pattern = allowedOrigin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*');
            return new RegExp(`^${pattern}$`).test(origin);
          }
          return allowedOrigin === origin;
        }) || origin.includes('localhost') || origin.includes('127.0.0.1');

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
