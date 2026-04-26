import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { round2 } from '../common/utils/money';

type PolicyBody = {
  code?: string;
  name?: string;
  entityType?: string;
  action?: string;
  minAmount?: number | null;
  maxAmount?: number | null;
  requiredSteps?: number;
  isActive?: boolean;
};

const clean = (value?: string | null) => {
  const result = value?.trim();
  return result ? result : null;
};

const amount = (value: unknown) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = round2(Number(value));
  if (!Number.isFinite(parsed) || parsed < 0) throw new BadRequestException('Amount must be zero or positive');
  return parsed;
};

const stepCount = (value: unknown) => {
  const parsed = Number(value ?? 1);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 5) throw new BadRequestException('requiredSteps must be between 1 and 5');
  return Math.trunc(parsed);
};

@Injectable()
export class ApprovalsPolicyAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async createPolicy(body: PolicyBody) {
    const code = clean(body.code)?.toUpperCase();
    const name = clean(body.name);
    const entityType = clean(body.entityType);
    const action = clean(body.action)?.toUpperCase();
    const minAmount = amount(body.minAmount);
    const maxAmount = amount(body.maxAmount);
    const requiredSteps = stepCount(body.requiredSteps);
    const isActive = body.isActive === undefined ? true : Boolean(body.isActive);

    if (!code) throw new BadRequestException('code is required');
    if (!name) throw new BadRequestException('name is required');
    if (!entityType) throw new BadRequestException('entityType is required');
    if (!action) throw new BadRequestException('action is required');
    if (minAmount !== null && maxAmount !== null && maxAmount < minAmount) throw new BadRequestException('maxAmount cannot be lower than minAmount');

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO approval_policies (code, name, entity_type, action, min_amount, max_amount, required_steps, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, code, name, entity_type, action, min_amount, max_amount, required_steps, is_active, created_at, updated_at`,
      code, name, entityType, action, minAmount, maxAmount, requiredSteps, isActive,
    );
    return this.mapPolicy(rows[0]);
  }

  async updatePolicy(id: string, body: PolicyBody) {
    const currentRows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT * FROM approval_policies WHERE id = $1::uuid LIMIT 1`, id);
    const current = currentRows[0];
    if (!current) throw new NotFoundException('Approval policy not found');

    const code = clean(body.code)?.toUpperCase() ?? current.code;
    const name = clean(body.name) ?? current.name;
    const entityType = clean(body.entityType) ?? current.entity_type;
    const action = clean(body.action)?.toUpperCase() ?? current.action;
    const minAmount = body.minAmount === undefined ? current.min_amount : amount(body.minAmount);
    const maxAmount = body.maxAmount === undefined ? current.max_amount : amount(body.maxAmount);
    const requiredSteps = body.requiredSteps === undefined ? Number(current.required_steps ?? 1) : stepCount(body.requiredSteps);
    const isActive = body.isActive === undefined ? Boolean(current.is_active) : Boolean(body.isActive);

    if (minAmount !== null && maxAmount !== null && Number(maxAmount) < Number(minAmount)) throw new BadRequestException('maxAmount cannot be lower than minAmount');

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `UPDATE approval_policies
       SET code = $2, name = $3, entity_type = $4, action = $5, min_amount = $6, max_amount = $7, required_steps = $8, is_active = $9, updated_at = now()
       WHERE id = $1::uuid
       RETURNING id, code, name, entity_type, action, min_amount, max_amount, required_steps, is_active, created_at, updated_at`,
      id, code, name, entityType, action, minAmount, maxAmount, requiredSteps, isActive,
    );
    return this.mapPolicy(rows[0]);
  }

  private mapPolicy(row: any) {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      entityType: row.entity_type,
      action: row.action,
      minAmount: row.min_amount === null ? null : round2(Number(row.min_amount)),
      maxAmount: row.max_amount === null ? null : round2(Number(row.max_amount)),
      requiredSteps: Number(row.required_steps ?? 1),
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
