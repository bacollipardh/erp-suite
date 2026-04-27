import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SalesReturnsService } from './sales-returns.service';
import { SalesReturnApprovalGateService } from './sales-return-approval-gate.service';
import { CreateSalesReturnDto } from './dto/create-sales-return.dto';
import { UpdateSalesReturnDto } from './dto/update-sales-return.dto';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';

@ApiTags('sales-returns')
@ApiBearerAuth()
@Controller('sales-returns')
export class SalesReturnsController {
  constructor(
    private readonly salesReturnsService: SalesReturnsService,
    private readonly salesReturnApprovalGateService: SalesReturnApprovalGateService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.salesReturnsRead)
  findAll(@Query() query: PaginationDto) {
    return this.salesReturnsService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.salesReturnsRead)
  findOne(@Param('id') id: string) {
    return this.salesReturnsService.findOne(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.salesReturnsManage)
  create(@Body() dto: CreateSalesReturnDto, @CurrentUser() user: JwtPayload) {
    return this.salesReturnsService.create(dto, user.sub);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.salesReturnsManage)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSalesReturnDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.salesReturnsService.update(id, dto, user.sub);
  }

  @Post(':id/post')
  @RequirePermissions(PERMISSIONS.salesReturnsManage)
  async post(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    await this.salesReturnApprovalGateService.assertPostAllowed(id, user.sub);
    return this.salesReturnsService.post(id, user.sub);
  }
}
