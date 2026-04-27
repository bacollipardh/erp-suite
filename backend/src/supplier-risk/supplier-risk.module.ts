import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SupplierRiskController } from './supplier-risk.controller';
import { SupplierRiskService } from './supplier-risk.service';

@Module({
  imports: [PrismaModule],
  controllers: [SupplierRiskController],
  providers: [SupplierRiskService],
})
export class SupplierRiskModule {}
