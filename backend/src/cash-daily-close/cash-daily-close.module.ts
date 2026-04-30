import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CashDailyCloseController } from './cash-daily-close.controller';
import { CashDailyCloseService } from './cash-daily-close.service';

@Module({
  imports: [PrismaModule],
  controllers: [CashDailyCloseController],
  providers: [CashDailyCloseService],
})
export class CashDailyCloseModule {}
