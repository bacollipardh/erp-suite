import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AgentOrderStatus,
  AgentOrderType,
  DocumentStatus,
  Prisma,
  WmsTaskStatus,
  WmsTaskType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CustomerCreditApprovalGateService } from '../sales-invoices/customer-credit-approval-gate.service';
import { SalesInvoicesService } from '../sales-invoices/sales-invoices.service';
import { SalesReturnsService } from '../sales-returns/sales-returns.service';
import { WmsService } from '../wms/wms.service';
import { toPaginatedResponse, toPagination } from '../common/utils/pagination';
import { AgentOrderQueryDto } from './dto/agent-order-query.dto';
import {
  CreateAgentOrderDto,
  CreateAgentOrderLineDto,
} from './dto/create-agent-order.dto';
import { UpdateAgentOrderDto } from './dto/update-agent-order.dto';
import {
  AssignAgentOrderDto,
  CreateAgentSalesInvoiceDto,
  CreateAgentSalesReturnDto,
} from './dto/agent-order-actions.dto';
import {
  CreateCustomerObjectDto,
  UpdateCustomerObjectDto,
} from './dto/customer-object.dto';

type Tx = Prisma.TransactionClient;

const SALES_ORDER_TYPES: AgentOrderType[] = [
  AgentOrderType.SALES_ORDER,
  AgentOrderType.EXCHANGE_ORDER,
];
const RETURN_ORDER_TYPES: AgentOrderType[] = [
  AgentOrderType.RETURN_ORDER,
  AgentOrderType.OPEN_RETURN_ORDER,
];

function nullableText(value?: string | null) {
  const clean = value?.trim();
  return clean ? clean : null;
}

function dateOnly(value?: string | Date | null) {
  if (!value) return undefined;
  const date = new Date(value);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function lineQty(value: unknown) {
  return Number(value ?? 0);
}

@Injectable()
export class AgentOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
    private readonly customerCreditApprovalGateService: CustomerCreditApprovalGateService,
    private readonly salesInvoicesService: SalesInvoicesService,
    private readonly salesReturnsService: SalesReturnsService,
    private readonly wmsService: WmsService,
  ) {}

  async findAll(query: AgentOrderQueryDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { skip, take } = toPagination(page, limit);
    const search = query.search?.trim();
    const where: Prisma.AgentOrderWhereInput = {
      ...(query.orderType
        ? { orderType: this.resolveOrderType(query.orderType) }
        : {}),
      ...(query.status ? { status: this.resolveStatus(query.status) } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.assignedPickerId
        ? { assignedPickerId: query.assignedPickerId }
        : {}),
      ...(search
        ? {
            OR: [
              { orderNo: { contains: search, mode: 'insensitive' } },
              { customer: { name: { contains: search, mode: 'insensitive' } } },
              {
                customerObject: {
                  name: { contains: search, mode: 'insensitive' },
                },
              },
              {
                warehouse: { name: { contains: search, mode: 'insensitive' } },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.agentOrder.findMany({
        where,
        include: this.orderInclude(),
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take,
      }),
      this.prisma.agentOrder.count({ where }),
    ]);

    return toPaginatedResponse({ items, total, page, limit });
  }

  async findOne(id: string) {
    const order = await this.prisma.agentOrder.findUnique({
      where: { id },
      include: this.orderInclude(true),
    });
    if (!order) throw new NotFoundException('Agent order not found');

    const tasks = await this.prisma.wmsTask.findMany({
      where: { sourceType: 'AGENT_ORDER', sourceId: id },
      include: {
        warehouse: true,
        item: true,
        sourceLocation: true,
        destinationLocation: true,
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    });

    return { ...order, tasks };
  }

  async create(dto: CreateAgentOrderDto, userId: string) {
    const order = await this.prisma.$transaction(async (tx) => {
      await this.validateOrderInput(dto, tx);
      const orderNo = await this.nextOrderNo(tx);

      return tx.agentOrder.create({
        data: {
          orderNo,
          orderType: dto.orderType,
          customerId: dto.customerId,
          customerObjectId: dto.customerObjectId || null,
          warehouseId: dto.warehouseId,
          sourceSalesInvoiceId: dto.sourceSalesInvoiceId || null,
          docDate: dateOnly(dto.docDate) ?? new Date(),
          dueDate: dateOnly(dto.dueDate),
          priority: dto.priority ?? 5,
          notes: nullableText(dto.notes),
          createdById: userId,
          lines: { create: this.mapLines(dto.lines) },
        },
        include: this.orderInclude(true),
      });
    });

    await this.audit(order.id, userId, 'CREATE', { orderNo: order.orderNo });
    return order;
  }

  async update(id: string, dto: UpdateAgentOrderDto, userId: string) {
    const existing = await this.findOne(id);
    if (!this.canEdit(existing.status)) {
      throw new BadRequestException(
        'Agent order can be changed only before WMS assignment',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const nextInput = {
        orderType: dto.orderType ?? existing.orderType,
        customerId: dto.customerId ?? existing.customerId,
        customerObjectId:
          dto.customerObjectId === undefined
            ? (existing.customerObjectId ?? undefined)
            : dto.customerObjectId,
        warehouseId: dto.warehouseId ?? existing.warehouseId,
        sourceSalesInvoiceId:
          dto.sourceSalesInvoiceId === undefined
            ? (existing.sourceSalesInvoiceId ?? undefined)
            : dto.sourceSalesInvoiceId,
        docDate:
          dto.docDate ??
          (existing.docDate instanceof Date
            ? existing.docDate.toISOString().slice(0, 10)
            : String(existing.docDate).slice(0, 10)),
        dueDate:
          dto.dueDate === undefined
            ? existing.dueDate
              ? String(existing.dueDate).slice(0, 10)
              : undefined
            : dto.dueDate,
        priority: dto.priority ?? existing.priority,
        notes: dto.notes ?? existing.notes ?? undefined,
        lines:
          dto.lines ??
          existing.lines.map((line: any) => ({
            itemId: line.itemId,
            salesInvoiceLineId: line.salesInvoiceLineId ?? undefined,
            description: line.description ?? undefined,
            qty: Number(line.qty),
            unitPrice: Number(line.unitPrice),
            discountPercent: Number(line.discountPercent ?? 0),
            taxPercent: Number(line.taxPercent),
            notes: line.notes ?? undefined,
          })),
      } satisfies CreateAgentOrderDto;

      await this.validateOrderInput(nextInput, tx);
      if (dto.lines) {
        await tx.agentOrderLine.deleteMany({ where: { agentOrderId: id } });
      }

      return tx.agentOrder.update({
        where: { id },
        data: {
          orderType: dto.orderType,
          customerId: dto.customerId,
          customerObjectId:
            dto.customerObjectId === undefined
              ? undefined
              : dto.customerObjectId || null,
          warehouseId: dto.warehouseId,
          sourceSalesInvoiceId:
            dto.sourceSalesInvoiceId === undefined
              ? undefined
              : dto.sourceSalesInvoiceId || null,
          docDate: dto.docDate ? dateOnly(dto.docDate) : undefined,
          dueDate:
            dto.dueDate === undefined
              ? undefined
              : (dateOnly(dto.dueDate) ?? null),
          priority: dto.priority,
          notes: dto.notes === undefined ? undefined : nullableText(dto.notes),
          lines: dto.lines ? { create: this.mapLines(dto.lines) } : undefined,
        },
        include: this.orderInclude(true),
      });
    });

    await this.audit(id, userId, 'UPDATE', dto);
    return updated;
  }

  async submit(id: string, userId: string) {
    return this.transition(id, userId, 'SUBMIT', [AgentOrderStatus.DRAFT], {
      status: AgentOrderStatus.SUBMITTED,
    });
  }

  async approve(id: string, userId: string) {
    return this.transition(
      id,
      userId,
      'APPROVE',
      [AgentOrderStatus.DRAFT, AgentOrderStatus.SUBMITTED],
      { status: AgentOrderStatus.APPROVED },
    );
  }

  async assign(id: string, dto: AssignAgentOrderDto, userId: string) {
    const order = await this.findOne(id);
    const assignable: AgentOrderStatus[] = [
      AgentOrderStatus.SUBMITTED,
      AgentOrderStatus.APPROVED,
    ];
    if (!assignable.includes(order.status)) {
      throw new BadRequestException(
        'Agent order must be submitted or approved before WMS assignment',
      );
    }

    const picker = await this.prisma.user.findUnique({
      where: { id: dto.assignedPickerId },
    });
    if (!picker || !picker.isActive) {
      throw new BadRequestException(
        'Picker/receiver user not found or inactive',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.wmsTask.deleteMany({
        where: {
          sourceType: 'AGENT_ORDER',
          sourceId: order.id,
          status: { in: [WmsTaskStatus.PENDING, WmsTaskStatus.IN_PROGRESS] },
        },
      });

      for (const line of order.lines) {
        await tx.wmsTask.create({
          data: {
            warehouseId: order.warehouseId,
            itemId: line.itemId,
            taskType: this.taskTypeForOrder(order.orderType),
            status: WmsTaskStatus.PENDING,
            qty: line.qty,
            sourceType: 'AGENT_ORDER',
            sourceId: order.id,
            referenceNo: order.orderNo,
            assignedToId: dto.assignedPickerId,
            priority: order.priority,
            notes: nullableText(dto.notes) ?? nullableText(line.notes),
            createdById: userId,
          },
        });
      }

      return tx.agentOrder.update({
        where: { id },
        data: {
          status: AgentOrderStatus.WMS_ASSIGNED,
          assignedPickerId: dto.assignedPickerId,
          assignedAt: new Date(),
        },
        include: this.orderInclude(true),
      });
    });

    await this.audit(id, userId, 'ASSIGN_WMS', {
      assignedPickerId: dto.assignedPickerId,
      notes: dto.notes,
    });
    return updated;
  }

  async start(id: string, userId: string) {
    const order = await this.findOne(id);
    if (order.status !== AgentOrderStatus.WMS_ASSIGNED) {
      throw new BadRequestException('Only WMS assigned orders can be started');
    }

    await this.prisma.wmsTask.updateMany({
      where: {
        sourceType: 'AGENT_ORDER',
        sourceId: id,
        status: WmsTaskStatus.PENDING,
      },
      data: { status: WmsTaskStatus.IN_PROGRESS },
    });

    await this.audit(id, userId, 'START_WMS');
    return this.transition(
      id,
      userId,
      'START_PICKING',
      [AgentOrderStatus.WMS_ASSIGNED],
      {
        status: AgentOrderStatus.PICKING,
      },
    );
  }

  async completeWms(id: string, userId: string) {
    const order = await this.findOne(id);
    const completable: AgentOrderStatus[] = [
      AgentOrderStatus.WMS_ASSIGNED,
      AgentOrderStatus.PICKING,
    ];
    if (!completable.includes(order.status)) {
      throw new BadRequestException(
        'Only assigned or in-progress orders can be completed in WMS',
      );
    }

    const now = new Date();
    const isReturn = RETURN_ORDER_TYPES.includes(order.orderType);
    const nextStatus = AgentOrderStatus.READY_FOR_DOCUMENT;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.wmsTask.updateMany({
        where: {
          sourceType: 'AGENT_ORDER',
          sourceId: id,
          status: { in: [WmsTaskStatus.PENDING, WmsTaskStatus.IN_PROGRESS] },
        },
        data: { status: WmsTaskStatus.DONE, completedAt: now },
      });

      return tx.agentOrder.update({
        where: { id },
        data: {
          status: nextStatus,
          pickedAt: isReturn ? undefined : now,
          receivedAt: isReturn ? now : undefined,
          readyAt: now,
        },
        include: this.orderInclude(true),
      });
    });

    await this.audit(id, userId, isReturn ? 'RECEIVE_WMS' : 'PICK_WMS');
    return updated;
  }

  async cancel(id: string, userId: string) {
    const order = await this.findOne(id);
    if (order.status === AgentOrderStatus.DOCUMENT_CREATED) {
      throw new BadRequestException(
        'Agent order with created document cannot be cancelled',
      );
    }

    await this.prisma.wmsTask.updateMany({
      where: {
        sourceType: 'AGENT_ORDER',
        sourceId: id,
        status: { in: [WmsTaskStatus.PENDING, WmsTaskStatus.IN_PROGRESS] },
      },
      data: { status: WmsTaskStatus.CANCELLED, completedAt: new Date() },
    });

    return this.transition(
      id,
      userId,
      'CANCEL',
      [
        AgentOrderStatus.DRAFT,
        AgentOrderStatus.SUBMITTED,
        AgentOrderStatus.APPROVED,
        AgentOrderStatus.WMS_ASSIGNED,
        AgentOrderStatus.PICKING,
        AgentOrderStatus.PICKED,
        AgentOrderStatus.RECEIVED,
        AgentOrderStatus.READY_FOR_DOCUMENT,
      ],
      { status: AgentOrderStatus.CANCELLED },
    );
  }

  async createSalesInvoice(
    id: string,
    dto: CreateAgentSalesInvoiceDto,
    userId: string,
  ) {
    const order = await this.findOne(id);
    if (!SALES_ORDER_TYPES.includes(order.orderType)) {
      throw new BadRequestException(
        'Only sales/exchange agent orders can create sales invoices',
      );
    }
    if (order.status !== AgentOrderStatus.READY_FOR_DOCUMENT) {
      throw new BadRequestException(
        'Agent order must be ready for document creation',
      );
    }
    if (order.salesInvoiceId) {
      throw new BadRequestException(
        'Sales invoice was already created for this agent order',
      );
    }

    const invoice = await this.salesInvoicesService.create(
      {
        seriesId: dto.seriesId,
        customerId: order.customerId,
        warehouseId: order.warehouseId,
        paymentMethodId: dto.paymentMethodId,
        docDate: dto.docDate ?? this.isoDate(order.docDate),
        dueDate:
          dto.dueDate ??
          (order.dueDate ? this.isoDate(order.dueDate) : undefined),
        notes:
          nullableText(dto.notes) ??
          `Created from agent order ${order.orderNo}${order.customerObject ? ` / ${order.customerObject.name}` : ''}`,
        lines: order.lines.map((line: any) => ({
          itemId: line.itemId,
          description: line.description ?? undefined,
          qty: Number(line.qty),
          unitPrice: Number(line.unitPrice),
          discountPercent: Number(line.discountPercent ?? 0),
          taxPercent: Number(line.taxPercent),
        })),
      },
      userId,
    );

    const wms = await this.prepareInvoiceWms(invoice.id, userId);
    let salesInvoice = invoice;
    let posted = false;
    let postWarning: string | null = null;

    if (dto.postImmediately) {
      if (!wms.ready) {
        postWarning = wms.warning ?? 'WMS preparation failed';
      } else {
        try {
          await this.customerCreditApprovalGateService.assertPostAllowed(
            invoice.id,
            userId,
          );
          salesInvoice = await this.salesInvoicesService.post(
            invoice.id,
            userId,
          );
          posted = true;
        } catch (error) {
          postWarning =
            error instanceof Error
              ? error.message
              : 'Sales invoice posting failed';
        }
      }
    }

    const updated = await this.prisma.agentOrder.update({
      where: { id },
      data: {
        salesInvoiceId: invoice.id,
        status: AgentOrderStatus.DOCUMENT_CREATED,
      },
      include: this.orderInclude(true),
    });

    await this.audit(id, userId, 'CREATE_SALES_INVOICE', {
      salesInvoiceId: invoice.id,
      docNo: invoice.docNo,
      wms,
      posted,
      postWarning,
    });
    return { order: updated, salesInvoice, wms, posted, postWarning };
  }

  async createSalesReturn(
    id: string,
    dto: CreateAgentSalesReturnDto,
    userId: string,
  ) {
    const order = await this.findOne(id);
    if (!RETURN_ORDER_TYPES.includes(order.orderType)) {
      throw new BadRequestException(
        'Only return agent orders can create sales returns',
      );
    }
    if (order.status !== AgentOrderStatus.READY_FOR_DOCUMENT) {
      throw new BadRequestException(
        'Agent order must be ready for document creation',
      );
    }
    if (order.salesReturnId) {
      throw new BadRequestException(
        'Sales return was already created for this agent order',
      );
    }
    if (!order.sourceSalesInvoiceId) {
      throw new BadRequestException(
        'Source sales invoice is required before creating a sales return',
      );
    }
    if (order.lines.some((line: any) => !line.salesInvoiceLineId)) {
      throw new BadRequestException(
        'Every return line must be linked to a source sales invoice line',
      );
    }

    const salesReturn = await this.salesReturnsService.create(
      {
        seriesId: dto.seriesId,
        salesInvoiceId: order.sourceSalesInvoiceId,
        customerId: order.customerId,
        docDate: dto.docDate ?? this.isoDate(order.docDate),
        reason: nullableText(dto.reason) ?? `Agent return ${order.orderNo}`,
        notes:
          nullableText(dto.notes) ??
          `Created from agent order ${order.orderNo}`,
        lines: order.lines.map((line: any) => ({
          salesInvoiceLineId: line.salesInvoiceLineId,
          itemId: line.itemId,
          qty: Number(line.qty),
          unitPrice: Number(line.unitPrice),
          taxPercent: Number(line.taxPercent),
        })),
      },
      userId,
    );

    const updated = await this.prisma.agentOrder.update({
      where: { id },
      data: {
        salesReturnId: salesReturn.id,
        status: AgentOrderStatus.DOCUMENT_CREATED,
      },
      include: this.orderInclude(true),
    });

    await this.audit(id, userId, 'CREATE_SALES_RETURN', {
      salesReturnId: salesReturn.id,
      docNo: salesReturn.docNo,
    });
    return { order: updated, salesReturn };
  }

  async findCustomerObjects(query: AgentOrderQueryDto = {}) {
    const search = query.search?.trim();
    return this.prisma.customerObject.findMany({
      where: {
        ...(query.customerId ? { customerId: query.customerId } : {}),
        ...(search
          ? {
              OR: [
                { code: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
                {
                  customer: { name: { contains: search, mode: 'insensitive' } },
                },
              ],
            }
          : {}),
      },
      include: { customer: true },
      orderBy: [{ customer: { name: 'asc' } }, { code: 'asc' }],
    });
  }

  async createCustomerObject(dto: CreateCustomerObjectDto, userId: string) {
    await this.ensureCustomer(dto.customerId, this.prisma);
    const created = await this.prisma.customerObject.create({
      data: {
        customerId: dto.customerId,
        code: dto.code.trim(),
        name: dto.name.trim(),
        address: nullableText(dto.address),
        city: nullableText(dto.city),
        contactName: nullableText(dto.contactName),
        phone: nullableText(dto.phone),
        notes: nullableText(dto.notes),
      },
      include: { customer: true },
    });
    await this.auditLogs.log({
      userId,
      entityType: 'customer_objects',
      entityId: created.id,
      action: 'CREATE',
      metadata: { code: created.code, customerId: created.customerId },
    });
    return created;
  }

  async updateCustomerObject(
    id: string,
    dto: UpdateCustomerObjectDto,
    userId: string,
  ) {
    const existing = await this.prisma.customerObject.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Customer object not found');

    const updated = await this.prisma.customerObject.update({
      where: { id },
      data: {
        code: dto.code?.trim(),
        name: dto.name?.trim(),
        address:
          dto.address === undefined ? undefined : nullableText(dto.address),
        city: dto.city === undefined ? undefined : nullableText(dto.city),
        contactName:
          dto.contactName === undefined
            ? undefined
            : nullableText(dto.contactName),
        phone: dto.phone === undefined ? undefined : nullableText(dto.phone),
        isActive: dto.isActive,
        notes: dto.notes === undefined ? undefined : nullableText(dto.notes),
      },
      include: { customer: true },
    });
    await this.auditLogs.log({
      userId,
      entityType: 'customer_objects',
      entityId: updated.id,
      action: 'UPDATE',
      metadata: dto,
    });
    return updated;
  }

  async findReturnSources(query: AgentOrderQueryDto = {}) {
    const search = query.search?.trim();
    const where: Prisma.SalesInvoiceWhereInput = {
      status: {
        in: [DocumentStatus.POSTED, DocumentStatus.PARTIALLY_RETURNED],
      },
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(search
        ? {
            OR: [
              { docNo: { contains: search, mode: 'insensitive' } },
              { customer: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    return this.prisma.salesInvoice.findMany({
      where,
      include: {
        customer: true,
        warehouse: true,
        lines: { include: { item: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? 100,
    });
  }

  async findPickers() {
    return this.prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: { select: { code: true, name: true } },
      },
      orderBy: { fullName: 'asc' },
    });
  }

  private async transition(
    id: string,
    userId: string,
    action: string,
    allowed: AgentOrderStatus[],
    data: Prisma.AgentOrderUpdateInput,
  ) {
    const order = await this.findOne(id);
    if (!allowed.includes(order.status)) {
      throw new BadRequestException(
        `Agent order cannot perform ${action} from status ${order.status}`,
      );
    }

    const updated = await this.prisma.agentOrder.update({
      where: { id },
      data,
      include: this.orderInclude(true),
    });
    await this.audit(id, userId, action);
    return updated;
  }

  private async validateOrderInput(
    dto: CreateAgentOrderDto,
    tx: Tx | PrismaService,
  ) {
    if (
      dto.dueDate &&
      new Date(dto.dueDate).getTime() < new Date(dto.docDate).getTime()
    ) {
      throw new BadRequestException(
        'Due date cannot be earlier than document date',
      );
    }

    if (
      dto.orderType === AgentOrderType.RETURN_ORDER &&
      !dto.sourceSalesInvoiceId
    ) {
      throw new BadRequestException(
        'Return orders must be linked to a posted sales invoice',
      );
    }

    const [customer, warehouse, customerObject, sourceInvoice] =
      await Promise.all([
        this.ensureCustomer(dto.customerId, tx),
        this.ensureWarehouse(dto.warehouseId, tx),
        dto.customerObjectId
          ? tx.customerObject.findUnique({
              where: { id: dto.customerObjectId },
            })
          : Promise.resolve(null),
        dto.sourceSalesInvoiceId
          ? tx.salesInvoice.findUnique({
              where: { id: dto.sourceSalesInvoiceId },
              include: { lines: true },
            })
          : Promise.resolve(null),
      ]);

    if (!customer || !warehouse) return;

    if (dto.customerObjectId) {
      if (!customerObject || !customerObject.isActive) {
        throw new BadRequestException('Customer object not found or inactive');
      }
      if (customerObject.customerId !== dto.customerId) {
        throw new BadRequestException(
          'Customer object must belong to the selected customer',
        );
      }
    }

    if (dto.sourceSalesInvoiceId) {
      if (!sourceInvoice)
        throw new BadRequestException('Source sales invoice not found');
      if (sourceInvoice.customerId !== dto.customerId) {
        throw new BadRequestException(
          'Source sales invoice must belong to the selected customer',
        );
      }
      if (
        sourceInvoice.status !== DocumentStatus.POSTED &&
        sourceInvoice.status !== DocumentStatus.PARTIALLY_RETURNED
      ) {
        throw new BadRequestException(
          'Source sales invoice must be posted or partially returned',
        );
      }
    }

    const itemIds = [...new Set(dto.lines.map((line) => line.itemId))];
    const items = await tx.item.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, isActive: true },
    });
    if (items.length !== itemIds.length) {
      throw new BadRequestException('One or more items were not found');
    }
    if (items.some((item) => !item.isActive)) {
      throw new BadRequestException('Agent order contains inactive items');
    }

    const sourceLineIds = dto.lines
      .map((line) => line.salesInvoiceLineId)
      .filter((id): id is string => Boolean(id));
    if (sourceLineIds.length) {
      if (!sourceInvoice) {
        throw new BadRequestException(
          'Source sales invoice is required when return lines are linked',
        );
      }
      const sourceLineMap = new Map<string, any>(
        sourceInvoice.lines.map((line: any) => [line.id, line]),
      );
      for (const line of dto.lines) {
        if (!line.salesInvoiceLineId) continue;
        const sourceLine = sourceLineMap.get(line.salesInvoiceLineId);
        if (!sourceLine) {
          throw new BadRequestException(
            'Return line does not belong to the selected sales invoice',
          );
        }
        if (sourceLine.itemId !== line.itemId) {
          throw new BadRequestException(
            'Return line item must match the source sales invoice line',
          );
        }
      }
    }

    if (dto.orderType === AgentOrderType.RETURN_ORDER) {
      const missing = dto.lines.find((line) => !line.salesInvoiceLineId);
      if (missing) {
        throw new BadRequestException(
          'Return order lines must reference source sales invoice lines',
        );
      }
    }
  }

  private async ensureCustomer(id: string, tx: Tx | PrismaService) {
    const record = await tx.customer.findUnique({ where: { id } });
    if (!record || !record.isActive) {
      throw new BadRequestException('Customer not found or inactive');
    }
    return record;
  }

  private async ensureWarehouse(id: string, tx: Tx | PrismaService) {
    const record = await tx.warehouse.findUnique({ where: { id } });
    if (!record || !record.isActive) {
      throw new BadRequestException('Warehouse not found or inactive');
    }
    return record;
  }

  private async nextOrderNo(tx: Tx) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const suffix = `${Date.now()}${attempt}`.slice(-8);
      const orderNo = `AO-${stamp}-${suffix}`;
      const exists = await tx.agentOrder.findUnique({ where: { orderNo } });
      if (!exists) return orderNo;
    }
    throw new BadRequestException('Could not generate agent order number');
  }

  private mapLines(lines: CreateAgentOrderLineDto[]) {
    return lines.map((line, index) => ({
      lineNo: index + 1,
      itemId: line.itemId,
      salesInvoiceLineId: line.salesInvoiceLineId || null,
      description: nullableText(line.description),
      qty: lineQty(line.qty),
      unitPrice: Number(line.unitPrice),
      discountPercent: Number(line.discountPercent ?? 0),
      taxPercent: Number(line.taxPercent),
      notes: nullableText(line.notes),
    }));
  }

  private canEdit(status: AgentOrderStatus) {
    const editable: AgentOrderStatus[] = [
      AgentOrderStatus.DRAFT,
      AgentOrderStatus.SUBMITTED,
      AgentOrderStatus.APPROVED,
    ];
    return editable.includes(status);
  }

  private taskTypeForOrder(orderType: AgentOrderType) {
    return RETURN_ORDER_TYPES.includes(orderType)
      ? WmsTaskType.RECEIVE
      : WmsTaskType.PICK;
  }

  private async prepareInvoiceWms(salesInvoiceId: string, userId: string) {
    try {
      await this.wmsService.planSalesPick(salesInvoiceId, userId);
      await this.wmsService.confirmSalesPick(salesInvoiceId, userId);
      await this.wmsService.packSalesInvoice(salesInvoiceId, userId);
      return { ready: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'WMS preparation failed';
      return { ready: false, warning: message };
    }
  }

  private resolveOrderType(value: string) {
    if (!Object.values(AgentOrderType).includes(value as AgentOrderType)) {
      throw new BadRequestException('Invalid agent order type');
    }
    return value as AgentOrderType;
  }

  private resolveStatus(value: string) {
    if (!Object.values(AgentOrderStatus).includes(value as AgentOrderStatus)) {
      throw new BadRequestException('Invalid agent order status');
    }
    return value as AgentOrderStatus;
  }

  private isoDate(value: Date | string) {
    return new Date(value).toISOString().slice(0, 10);
  }

  private orderInclude(withLines = false) {
    return {
      customer: true,
      customerObject: true,
      warehouse: true,
      sourceSalesInvoice: {
        include: { lines: withLines ? { include: { item: true } } : false },
      },
      salesInvoice: true,
      salesReturn: true,
      assignedPicker: { select: { id: true, fullName: true, email: true } },
      createdBy: { select: { id: true, fullName: true, email: true } },
      lines: withLines
        ? {
            include: {
              item: true,
              salesInvoiceLine: { include: { item: true } },
            },
            orderBy: { lineNo: 'asc' as const },
          }
        : false,
    };
  }

  private audit(
    entityId: string,
    userId: string,
    action: string,
    metadata?: unknown,
  ) {
    return this.auditLogs.log({
      userId,
      entityType: 'agent_orders',
      entityId,
      action,
      metadata,
    });
  }
}
