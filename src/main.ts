import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { configureApp } from './app.config';
import { AppModule } from './app.module';
import { validateEnvironment } from './config/environment.validation';

export async function createApp(): Promise<INestApplication> {
  validateEnvironment();
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  // Required behind reverse proxies (Nginx/ALB/Cloudflare) so req.ip reflects the real client.
  // Without this, Nest/Express sees only the proxy IP, which breaks ThrottlerGuard and IP-based logging.
  const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? '1');
  app.getHttpAdapter().getInstance().set('trust proxy', trustProxyHops);
  app.enableShutdownHooks();
  configureApp(app);
  return app;
}

async function bootstrap() {
  const app = await createApp();
  await app.listen(process.env.PORT ?? 3000);
}

if (require.main === module) {
  void bootstrap();
}
