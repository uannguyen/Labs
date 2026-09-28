import { NestFactory } from '@nestjs/core';
import { PartnerModule } from './partner.module';

async function bootstrap() {
  const app = await NestFactory.create(PartnerModule);
  await app.listen(process.env.PORT ?? 3003);
}
bootstrap();
