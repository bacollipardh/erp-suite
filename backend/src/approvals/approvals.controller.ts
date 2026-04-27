import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { ApprovalsService } from './approvals.service';
import { ApprovalsDashboardService } from './approvals-dashboard.service';
import { ApprovalsPolicyAdminService } from './approvals-policy-admin.service';

type CreateApprovalRequestBody = {
  entityType: string;
  entityId?: string;
  entityNo?: string;
  action: string;
  title: string;
  description?: string;
  amount?: number;
  currencyCode?: string;
  metadata?: Record<string, unknown>;
};

type PolicyBody = {
  code?: string;
  name?: string;
  entityType?: string;
  action?: string;
  minAmount?: number | null;
  maxAmount?: number | null;
  requiredSteps?: number;
  isActive?: boolean;
};

type PolicyStepsBody = {
  steps?: {
    stepNo?: number;
    approverRoleCode?: string | null;
    approverUserId?: string | null;
    label?: string | null;
    isRequired?: boolean;
  }[];
};

type DecisionBody = {
  note?: string;
};

@ApiTags('approvals')
@ApiBearerAuth()
@Controller('approvals')
export class ApprovalsController {
  constructor(
    private readonly approvalsService: ApprovalsService,
    private readonly approvalsDashboardService: ApprovalsDashboardService,
    private readonly approvalsPolicyAdminService: ApprovalsPolicyAdminService,
  ) {}

  @Get('dashboard')
  @RequirePermissions(PERMISSIONS.dashboard)
  getDashboard() {
    return this.approvalsDashboardService.getDashboard();
  }

  @Get('badge')
  @RequirePermissions(PERMISSIONS.dashboard)
  getBadge(@CurrentUser() user: JwtPayload) {
    return this.approvalsService.getPendingBadge(user.sub);
  }

  @Get('policies')
  @RequirePermissions(PERMISSIONS.dashboard)
  findPolicies() {
    return this.approvalsService.findPolicies();
  }

  @Post('policies')
  @RequirePermissions(PERMISSIONS.dashboard)
  createPolicy(@Body() body: PolicyBody) {
    return this.approvalsPolicyAdminService.createPolicy(body);
  }

  @Patch('policies/:id')
  @RequirePermissions(PERMISSIONS.dashboard)
  updatePolicy(@Param('id') id: string, @Body() body: PolicyBody) {
    return this.approvalsPolicyAdminService.updatePolicy(id, body);
  }

  @Get('policies/:id/steps')
  @RequirePermissions(PERMISSIONS.dashboard)
  getPolicySteps(@Param('id') id: string) {
    return this.approvalsPolicyAdminService.getPolicySteps(id);
  }

  @Patch('policies/:id/steps')
  @RequirePermissions(PERMISSIONS.dashboard)
  updatePolicySteps(@Param('id') id: string, @Body() body: PolicyStepsBody) {
    return this.approvalsPolicyAdminService.updatePolicySteps(id, body);
  }

  @Get('requests')
  @RequirePermissions(PERMISSIONS.dashboard)
  findRequests(
    @Query('status') status?: string,
    @Query('scope') scope?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.approvalsService.findRequests({ status, scope, search, limit }, user?.sub);
  }

  @Get('requests/:id')
  @RequirePermissions(PERMISSIONS.dashboard)
  findOne(@Param('id') id: string) {
    return this.approvalsService.findOne(id);
  }

  @Post('requests')
  @RequirePermissions(PERMISSIONS.dashboard)
  createRequest(@Body() body: CreateApprovalRequestBody, @CurrentUser() user: JwtPayload) {
    return this.approvalsService.createRequest(body, user.sub);
  }

  @Post('requests/:id/approve')
  @RequirePermissions(PERMISSIONS.dashboard)
  approve(@Param('id') id: string, @Body() body: DecisionBody, @CurrentUser() user: JwtPayload) {
    return this.approvalsService.approve(id, body.note, user.sub);
  }

  @Post('requests/:id/reject')
  @RequirePermissions(PERMISSIONS.dashboard)
  reject(@Param('id') id: string, @Body() body: DecisionBody, @CurrentUser() user: JwtPayload) {
    return this.approvalsService.reject(id, body.note, user.sub);
  }

  @Post('requests/:id/cancel')
  @RequirePermissions(PERMISSIONS.dashboard)
  cancel(@Param('id') id: string, @Body() body: DecisionBody, @CurrentUser() user: JwtPayload) {
    return this.approvalsService.cancel(id, body.note, user.sub);
  }

  @Post('requests/:id/comment')
  @RequirePermissions(PERMISSIONS.dashboard)
  comment(@Param('id') id: string, @Body() body: DecisionBody, @CurrentUser() user: JwtPayload) {
    return this.approvalsService.comment(id, body.note, user.sub);
  }
}
