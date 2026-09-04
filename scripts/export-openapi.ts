/**
 * Generates a standalone `openapi.json` document describing every REST endpoint
 * in the RIVE backend (path, method, DTOs, request/response shapes, error codes),
 * without starting the real HTTP server or requiring a live database/Stripe/
 * Cloudinary/email connection.
 *
 * This script intentionally does NOT import or modify `src/app.config.ts`. It
 * builds an equivalent `DocumentBuilder` configuration in isolation and boots
 * the real `AppModule` (so every controller/DTO is introspected), with
 * `PrismaService` replaced by a no-op stub so the process never attempts a
 * real database connection.
 *
 * Usage: npx ts-node scripts/export-openapi.ts
 */
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';

import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

async function exportOpenApiDocument() {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue({
      $connect: async () => undefined,
      $disconnect: async () => undefined,
      // OrdersService.onModuleInit() eagerly expires stale reservations on boot;
      // stub it out so document generation never touches a real database.
      order: { findMany: async () => [] },
    })
    .compile();

  const app = moduleRef.createNestApplication();
  await app.init();

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

  const outputPath = resolve(__dirname, '..', 'openapi.json');
  writeFileSync(outputPath, JSON.stringify(document, null, 2) + '\n', 'utf8');

  await app.close();

  console.log(`OpenAPI document written to ${outputPath}`);
}

exportOpenApiDocument().catch((error) => {
  console.error('Failed to export OpenAPI document:', error);
  process.exitCode = 1;
});
