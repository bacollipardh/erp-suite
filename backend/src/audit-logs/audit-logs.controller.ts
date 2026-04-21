import { Controller, Get, Query } from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.auditLogsRead)
  findAll(@Query() query: PaginationDto) {
    return this.auditLogsService.findAll(query);
  }
}
