import { Module } from '@nestjs/common';
import { FiscalizationController } from './fiscalization.controller';
import { FiscalizationService } from './fiscalization.service';
import { KosovoFiscalizationAdapter } from './kosovo-fiscalization.adapter';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [AuditLogsModule],
  controllers: [FiscalizationController],
  providers: [FiscalizationService, KosovoFiscalizationAdapter],
})
export class FiscalizationModule {}
