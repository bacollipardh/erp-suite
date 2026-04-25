import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { ApprovalsService } from './approvals.service';

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

type DecisionBody = {
  note?: string;
};

@ApiTags('approvals')
@ApiBearerAuth()
@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Get('policies')
  @RequirePermissions(PERMISSIONS.dashboard)
  findPolicies() {
    return this.approvalsService.findPolicies();
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
