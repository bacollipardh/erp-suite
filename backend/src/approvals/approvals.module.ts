import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';
import { ApprovalsDashboardService } from './approvals-dashboard.service';

@Module({
  imports: [PrismaModule],
  controllers: [ApprovalsController],
  providers: [ApprovalsService, ApprovalsDashboardService],
})
export class ApprovalsModule {}
