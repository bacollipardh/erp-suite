import { Module } from '@nestjs/common';
import { FinanceSettlementsController } from './finance-settlements.controller';
import { FinanceSettlementsService } from './finance-settlements.service';

@Module({
  controllers: [FinanceSettlementsController],
  providers: [FinanceSettlementsService],
  exports: [FinanceSettlementsService],
})
export class FinanceSettlementsModule {}
