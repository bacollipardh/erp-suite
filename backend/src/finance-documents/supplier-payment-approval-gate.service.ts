import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { round2 } from '../common/utils/money';

type Tx = Prisma.TransactionClient;

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

@Injectable()
export class SupplierPaymentApprovalGateService {
  constructor(private readonly prisma: PrismaService) {}

  async assertPostAllowed(supplierPaymentId: string, userId: string) {
    const payment = await this.getPaymentOrThrow(supplierPaymentId);
    const amount = round2(toNumber(payment.entered_amount));
    const policy = await this.findPolicy(amount);

    if (!policy) return;

    const existing = await this.findExistingRequest(supplierPaymentId);
    if (existing?.status === 'APPROVED') return;

    if (existing?.status === 'PENDING') {
      throw new BadRequestException(
        `Supplier payment requires approval before posting. Approval request already pending: ${existing.id}`,
      );
    }

    const requestId = await this.createApprovalRequest(payment, policy, amount, userId);
    throw new BadRequestException(
      `Supplier payment requires approval before posting. Approval request created: ${requestId}`,
    );
  }

  private async getPaymentOrThrow(id: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT sp.*, s.name AS supplier_name
      FROM supplier_payments sp
      JOIN suppliers s ON s.id = sp.supplier_id
      WHERE sp.id = $1::uuid
      LIMIT 1
      `,
      id,
    );

    if (!rows[0]) throw new NotFoundException('Supplier payment not found');
    return rows[0];
  }

  private async findPolicy(amount: number) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT *
      FROM approval_policies
      WHERE is_active = true
        AND entity_type = 'supplier-payments'
        AND action = 'POST'
        AND (min_amount IS NULL OR min_amount <= $1)
        AND (max_amount IS NULL OR max_amount >= $1)
      ORDER BY min_amount DESC NULLS LAST
      LIMIT 1
      `,
      amount,
    );

    return rows[0] ?? null;
  }

  private async findExistingRequest(supplierPaymentId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT id, status
      FROM approval_requests
      WHERE entity_type = 'supplier-payments'
        AND entity_id = $1::uuid
        AND action = 'POST'
        AND status IN ('PENDING', 'APPROVED')
      ORDER BY requested_at DESC
      LIMIT 1
      `,
      supplierPaymentId,
    );

    return rows[0] ?? null;
  }

  private async createApprovalRequest(payment: any, policy: any, amount: number, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<any[]>(
        `
        INSERT INTO approval_requests (
          policy_id, entity_type, entity_id, entity_no, action, title, description,
          amount, currency_code, requested_by_id, current_step, required_steps, metadata
        ) VALUES (
          $1::uuid, 'supplier-payments', $2::uuid, $3, 'POST', $4, $5,
          $6, 'EUR', $7::uuid, 1, $8, $9::jsonb
        )
        RETURNING id
        `,
        policy.id,
        payment.id,
        payment.doc_no,
        `Approval required for supplier payment ${payment.doc_no}`,
        `Supplier payment ${payment.doc_no} for ${payment.supplier_name} requires approval before posting.`,
        amount,
        userId,
        Number(policy.required_steps ?? 1),
        JSON.stringify({
          gate: 'supplier-payment-post',
          supplierId: payment.supplier_id,
          supplierName: payment.supplier_name,
          financeAccountId: payment.finance_account_id,
          docNo: payment.doc_no,
          amount,
        }),
      );

      const requestId = rows[0].id;
      const requiredSteps = Number(policy.required_steps ?? 1);
      for (let stepNo = 1; stepNo <= requiredSteps; stepNo += 1) {
        await this.createStepTx(tx, requestId, stepNo, policy.id);
      }
      await this.createEventTx(tx, requestId, userId, `Approval gate created request for supplier payment ${payment.doc_no}`);
      return requestId;
    });
  }

  private async createStepTx(tx: Tx, requestId: string, stepNo: number, policyId: string) {
    await tx.$executeRawUnsafe(
      `
      INSERT INTO approval_request_steps (approval_request_id, step_no, status, approver_role_code, approver_user_id)
      SELECT $1::uuid, $2, 'PENDING', ps.approver_role_code, ps.approver_user_id
      FROM approval_policy_steps ps
      WHERE ps.policy_id = $3::uuid AND ps.step_no = $2
      UNION ALL
      SELECT $1::uuid, $2, 'PENDING', NULL, NULL
      WHERE NOT EXISTS (
        SELECT 1 FROM approval_policy_steps ps WHERE ps.policy_id = $3::uuid AND ps.step_no = $2
      )
      `,
      requestId,
      stepNo,
      policyId,
    );
  }

  private async createEventTx(tx: Tx, requestId: string, userId: string, note: string) {
    await tx.$executeRawUnsafe(
      `
      INSERT INTO approval_request_events (approval_request_id, action, note, created_by_id)
      VALUES ($1::uuid, 'REQUESTED', $2, $3::uuid)
      `,
      requestId,
      note,
      userId,
    );
  }
}
