import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { CompanyPulseService } from './company-pulse.service';

@ApiTags('company-pulse')
@ApiBearerAuth()
@Controller('control-tower')
export class CompanyPulseController {
  constructor(private readonly companyPulseService: CompanyPulseService) {}

  @Get('pulse')
  @RequirePermissions(PERMISSIONS.dashboard)
  getPulse() {
    return this.companyPulseService.getPulse();
  }
}
