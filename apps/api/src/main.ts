import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { webOriginFromEnv } from './common/web-origin';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const webOrigin = webOriginFromEnv(config.get<string>('WEB_ORIGIN'));

  app.use(cookieParser());
  app.enableCors({
    origin: webOrigin,
    credentials: true,
  });

  const port = Number(config.get('PORT') ?? 3001);
  await app.listen(port, '0.0.0.0');
  console.log(`MileTriage API listening on 0.0.0.0:${port}`);
}
bootstrap();
