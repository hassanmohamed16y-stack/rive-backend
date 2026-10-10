import { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import * as Sentry from "@sentry/nestjs";
import { configureApp } from "./app.config";
import { AppModule } from "./app.module";
import { validateEnvironment } from "./config/environment.validation";

// Ensure environment variables are validated as the very first operation at startup
try {
  validateEnvironment();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("==========================================================================");
  console.error("❌ CRITICAL ENVIRONMENT CONFIGURATION ERROR / خطأ حرجي في تهيئة البيئة:");
  console.error(message);
  console.error("==========================================================================");
  process.exit(1);
}

if (process.env.SENTRY_DSN?.trim()) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN.trim(),
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: 1.0,
  });
}

export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    rawBody: true,
  });
  // Required behind reverse proxies (Nginx/ALB/Cloudflare) so req.ip reflects the real client.
  // Without this, Nest/Express sees only the proxy IP, which breaks ThrottlerGuard and IP-based logging.
  const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? "1");
  app.getHttpAdapter().getInstance().set("trust proxy", trustProxyHops);
  app.enableShutdownHooks();
  configureApp(app);
  return app;
}

let cachedServer: any;

export default async function handler(req: any, res: any) {
  if (!cachedServer) {
    const app = await createApp();
    await app.init();
    cachedServer = app.getHttpAdapter().getInstance();
  }
  return cachedServer(req, res);
}

async function bootstrap() {
  const app = await createApp();
  await app.listen(process.env.PORT ?? 3000);
}

if (!process.env.VERCEL && require.main === module) {
  void bootstrap();
}
