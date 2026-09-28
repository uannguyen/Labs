import { NestFactory } from '@nestjs/core';
import { WalletModule } from './wallet.module';

async function bootstrap() {
  const app = await NestFactory.create(WalletModule);
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
