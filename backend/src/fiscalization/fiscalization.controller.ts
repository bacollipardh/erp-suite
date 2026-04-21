import { Controller, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FiscalizationService } from './fiscalization.service';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';

@ApiTags('fiscalization')
@ApiBearerAuth()
@Controller('fiscalization')
export class FiscalizationController {
  constructor(private readonly fiscalizationService: FiscalizationService) {}

  @Post('sales-invoices/:id/submit')
  @RequirePermissions(PERMISSIONS.fiscalize)
  submitSalesInvoice(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.fiscalizationService.submitSalesInvoice(id, user.sub);
  }

  @Post('sales-returns/:id/submit')
  @RequirePermissions(PERMISSIONS.fiscalize)
  submitSalesReturn(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.fiscalizationService.submitSalesReturn(id, user.sub);
  }
}
