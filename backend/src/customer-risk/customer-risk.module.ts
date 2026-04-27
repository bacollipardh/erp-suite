import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CustomerRiskController } from './customer-risk.controller';
import { CustomerRiskService } from './customer-risk.service';

@Module({
  imports: [PrismaModule],
  controllers: [CustomerRiskController],
  providers: [CustomerRiskService],
})
export class CustomerRiskModule {}
