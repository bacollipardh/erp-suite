import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AgentOrdersService } from './agent-orders.service';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { AgentOrderQueryDto } from './dto/agent-order-query.dto';
import { CreateAgentOrderDto } from './dto/create-agent-order.dto';
import { UpdateAgentOrderDto } from './dto/update-agent-order.dto';
import {
  AssignAgentOrderDto,
  CreateAgentSalesInvoiceDto,
  CreateAgentSalesReturnDto,
} from './dto/agent-order-actions.dto';
import { CreateCustomerObjectDto, UpdateCustomerObjectDto } from './dto/customer-object.dto';

@ApiTags('agent-orders')
@ApiBearerAuth()
@Controller('agent-orders')
export class AgentOrdersController {
  constructor(private readonly service: AgentOrdersService) {}

  @Get('customer-objects')
  @RequirePermissions(PERMISSIONS.agentOrdersRead)
  findCustomerObjects(@Query() query: AgentOrderQueryDto) {
    return this.service.findCustomerObjects(query);
  }

  @Post('customer-objects')
  @RequirePermissions(PERMISSIONS.agentOrdersManage)
  createCustomerObject(@Body() dto: CreateCustomerObjectDto, @CurrentUser() user: JwtPayload) {
    return this.service.createCustomerObject(dto, user.sub);
  }

  @Patch('customer-objects/:id')
  @RequirePermissions(PERMISSIONS.agentOrdersManage)
  updateCustomerObject(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerObjectDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateCustomerObject(id, dto, user.sub);
  }

  @Get('return-sources')
  @RequirePermissions(PERMISSIONS.agentOrdersRead)
  findReturnSources(@Query() query: AgentOrderQueryDto) {
    return this.service.findReturnSources(query);
  }

  @Get('pickers')
  @RequirePermissions(PERMISSIONS.agentOrdersAssign)
  findPickers() {
    return this.service.findPickers();
  }

  @Get()
  @RequirePermissions(PERMISSIONS.agentOrdersRead)
  findAll(@Query() query: AgentOrderQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.agentOrdersRead)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.agentOrdersManage)
  create(@Body() dto: CreateAgentOrderDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.agentOrdersManage)
  update(@Param('id') id: string, @Body() dto: UpdateAgentOrderDto, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, dto, user.sub);
  }

  @Post(':id/submit')
  @RequirePermissions(PERMISSIONS.agentOrdersManage)
  submit(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.submit(id, user.sub);
  }

  @Post(':id/approve')
  @RequirePermissions(PERMISSIONS.agentOrdersManage)
  approve(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.approve(id, user.sub);
  }

  @Post(':id/assign')
  @RequirePermissions(PERMISSIONS.agentOrdersAssign)
  assign(@Param('id') id: string, @Body() dto: AssignAgentOrderDto, @CurrentUser() user: JwtPayload) {
    return this.service.assign(id, dto, user.sub);
  }

  @Post(':id/start')
  @RequirePermissions(PERMISSIONS.agentOrdersAssign)
  start(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.start(id, user.sub);
  }

  @Post(':id/complete-wms')
  @RequirePermissions(PERMISSIONS.agentOrdersAssign)
  completeWms(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.completeWms(id, user.sub);
  }

  @Post(':id/cancel')
  @RequirePermissions(PERMISSIONS.agentOrdersManage)
  cancel(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.cancel(id, user.sub);
  }

  @Post(':id/create-sales-invoice')
  @RequirePermissions(PERMISSIONS.agentOrdersManage)
  createSalesInvoice(
    @Param('id') id: string,
    @Body() dto: CreateAgentSalesInvoiceDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createSalesInvoice(id, dto, user.sub);
  }

  @Post(':id/create-sales-return')
  @RequirePermissions(PERMISSIONS.agentOrdersManage)
  createSalesReturn(
    @Param('id') id: string,
    @Body() dto: CreateAgentSalesReturnDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createSalesReturn(id, dto, user.sub);
  }
}
