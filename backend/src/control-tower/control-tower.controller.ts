import { Controller, Get } from '@nestjs/common';
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
  getExceptions() {
    return this.controlTowerService.getExceptions();
  }
}
