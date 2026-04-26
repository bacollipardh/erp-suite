import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { round2 } from '../common/utils/money';

type Tx = Prisma.TransactionClient;

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

@Injectable()
export class SalesReturnApprovalGateService {
  constructor(private readonly prisma: PrismaService) {}

  async assertPostAllowed(salesReturnId: string, userId: string) {
    const salesReturn = await this.getSalesReturnOrThrow(salesReturnId);
    const amount = round2(toNumber(salesReturn.grand_total));
    const policy = await this.findPolicy(amount);

    if (!policy) return;

    const existing = await this.findExistingRequest(salesReturnId);
    if (existing?.status === 'APPROVED') return;

    if (existing?.status === 'PENDING') {
      throw new BadRequestException(
        `Sales return requires approval before posting. Approval request already pending: ${existing.id}`,
      );
    }

    const requestId = await this.createApprovalRequest(salesReturn, policy, amount, userId);
    throw new BadRequestException(
      `Sales return requires approval before posting. Approval request created: ${requestId}`,
    );
  }

  private async getSalesReturnOrThrow(id: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT sr.*, c.name AS customer_name, si.doc_no AS sales_invoice_no
      FROM sales_returns sr
      JOIN customers c ON c.id = sr.customer_id
      JOIN sales_invoices si ON si.id = sr.sales_invoice_id
      WHERE sr.id = $1::uuid
      LIMIT 1
      `,
      id,
    );

    if (!rows[0]) throw new NotFoundException('Sales return not found');
    return rows[0];
  }

  private async findPolicy(amount: number) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT *
      FROM approval_policies
      WHERE is_active = true
        AND entity_type = 'sales-returns'
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

  private async findExistingRequest(salesReturnId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT id, status
      FROM approval_requests
      WHERE entity_type = 'sales-returns'
        AND entity_id = $1::uuid
        AND action = 'POST'
        AND status IN ('PENDING', 'APPROVED')
      ORDER BY requested_at DESC
      LIMIT 1
      `,
      salesReturnId,
    );

    return rows[0] ?? null;
  }

  private async createApprovalRequest(salesReturn: any, policy: any, amount: number, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<any[]>(
        `
        INSERT INTO approval_requests (
          policy_id, entity_type, entity_id, entity_no, action, title, description,
          amount, currency_code, requested_by_id, current_step, required_steps, metadata
        ) VALUES (
          $1::uuid, 'sales-returns', $2::uuid, $3, 'POST', $4, $5,
          $6, 'EUR', $7::uuid, 1, $8, $9::jsonb
        )
        RETURNING id
        `,
        policy.id,
        salesReturn.id,
        salesReturn.doc_no,
        `Approval required for sales return ${salesReturn.doc_no}`,
        `Sales return ${salesReturn.doc_no} for ${salesReturn.customer_name} requires approval before posting.`,
        amount,
        userId,
        Number(policy.required_steps ?? 1),
        JSON.stringify({
          gate: 'sales-return-post',
          customerId: salesReturn.customer_id,
          customerName: salesReturn.customer_name,
          salesInvoiceId: salesReturn.sales_invoice_id,
          salesInvoiceNo: salesReturn.sales_invoice_no,
          docNo: salesReturn.doc_no,
          amount,
        }),
      );

      const requestId = rows[0].id;
      const requiredSteps = Number(policy.required_steps ?? 1);
      for (let stepNo = 1; stepNo <= requiredSteps; stepNo += 1) {
        await this.createStepTx(tx, requestId, stepNo, policy.id);
      }
      await this.createEventTx(tx, requestId, userId, `Approval gate created request for sales return ${salesReturn.doc_no}`);
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
      `INSERT INTO approval_request_events (approval_request_id, action, note, created_by_id) VALUES ($1::uuid, 'REQUESTED', $2, $3::uuid)`,
      requestId,
      note,
      userId,
    );
  }
}
