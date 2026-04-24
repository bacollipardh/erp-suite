import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { ControlTowerService } from './control-tower.service';

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
  ) {
    return this.controlTowerService.getExceptions({ category, severity });
  }
}
