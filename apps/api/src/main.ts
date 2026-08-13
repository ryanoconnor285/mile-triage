import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import type { Express } from 'express';
import { AppModule } from './app.module';
import { webOriginFromEnv } from './common/web-origin';
import { ZodExceptionFilter } from './common/zod-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const webOrigin = webOriginFromEnv(config.get<string>('WEB_ORIGIN'));

  // Railway/nginx terminates TLS; honor X-Forwarded-Proto for Secure cookies.
  const expressApp = app.getHttpAdapter().getInstance() as Express;
  expressApp.set('trust proxy', 1);

  app.use(cookieParser());
  app.useGlobalFilters(new ZodExceptionFilter());
  app.enableCors({
    origin: webOrigin,
    credentials: true,
  });

  const port = Number(config.get('PORT') ?? 3001);
  await app.listen(port, '0.0.0.0');
  console.log(`MileTriage API listening on 0.0.0.0:${port}`);
}
void bootstrap();
