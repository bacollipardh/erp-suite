import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { ControlTowerService } from './control-tower.service';

type WorkflowActionBody = {
  action: 'ACKNOWLEDGE' | 'START' | 'ASSIGN' | 'SNOOZE' | 'RESOLVE' | 'REOPEN' | 'NOTE';
  note?: string;
  assignedToId?: string;
  snoozedUntil?: string;
};

@ApiTags('control-tower')
@ApiBearerAuth()
@Controller('control-tower')
export class ControlTowerController {
  constructor(private readonly controlTowerService: ControlTowerService) {}

  @Get('exceptions')
  @RequirePermissions(PERMISSIONS.dashboard)
  getExceptions(
    @Query('category') category?: string,
    @Query('severity') severity?: string,
    @Query('workflowStatus') workflowStatus?: string,
  ) {
    return this.controlTowerService.getExceptions({ category, severity, workflowStatus });
  }

  @Post('exceptions/:exceptionKey/actions')
  @RequirePermissions(PERMISSIONS.dashboard)
  applyAction(
    @Param('exceptionKey') exceptionKey: string,
    @Body() body: WorkflowActionBody,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.controlTowerService.applyAction(exceptionKey, body, user.sub);
  }
}
