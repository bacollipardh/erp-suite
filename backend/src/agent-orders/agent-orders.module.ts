import { Module } from '@nestjs/common';
import { AgentOrdersController } from './agent-orders.controller';
import { AgentOrdersService } from './agent-orders.service';
import { SalesInvoicesModule } from '../sales-invoices/sales-invoices.module';
import { SalesReturnsModule } from '../sales-returns/sales-returns.module';
import { WmsModule } from '../wms/wms.module';

@Module({
  imports: [SalesInvoicesModule, SalesReturnsModule, WmsModule],
  controllers: [AgentOrdersController],
  providers: [AgentOrdersService],
  exports: [AgentOrdersService],
})
export class AgentOrdersModule {}
