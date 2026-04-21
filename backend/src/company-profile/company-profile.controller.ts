import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CompanyProfileService } from './company-profile.service';
import { UpsertCompanyProfileDto } from './dto/upsert-company-profile.dto';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';

@ApiTags('company-profile')
@ApiBearerAuth()
@Controller('company-profile')
export class CompanyProfileController {
  constructor(private readonly service: CompanyProfileService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.companyProfileRead)
  get() {
    return this.service.get();
  }

  @Put()
  @RequirePermissions(PERMISSIONS.companyProfileManage)
  upsert(@Body() dto: UpsertCompanyProfileDto) {
    return this.service.upsert(dto);
  }
}
