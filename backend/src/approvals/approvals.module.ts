import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';
import { ApprovalsDashboardService } from './approvals-dashboard.service';
import { ApprovalsPolicyAdminService } from './approvals-policy-admin.service';

@Module({
  imports: [PrismaModule],
  controllers: [ApprovalsController],
  providers: [ApprovalsService, ApprovalsDashboardService, ApprovalsPolicyAdminService],
})
export class ApprovalsModule {}
