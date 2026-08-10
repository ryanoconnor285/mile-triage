import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const webOrigin = config.get<string>('WEB_ORIGIN') ?? 'http://localhost:5173';

  app.use(cookieParser());
  app.enableCors({
    origin: webOrigin,
    credentials: true,
  });

  const port = Number(config.get('PORT') ?? 3001);
  await app.listen(port);
  console.log(`MileTriage API listening on http://localhost:${port}`);
}
bootstrap();
