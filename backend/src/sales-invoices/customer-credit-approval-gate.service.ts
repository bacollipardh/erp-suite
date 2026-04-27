import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { round2 } from '../common/utils/money';

type Tx = Prisma.TransactionClient;

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

@Injectable()
export class CustomerCreditApprovalGateService {
  constructor(private readonly prisma: PrismaService) {}

  async assertPostAllowed(salesInvoiceId: string, userId: string) {
    const invoice = await this.getInvoiceOrThrow(salesInvoiceId);
    const creditLimit = toNumber(invoice.credit_limit);

    if (creditLimit <= 0) return;

    const exposureBefore = await this.getCustomerExposure(invoice.customer_id, salesInvoiceId);
    const invoiceAmount = round2(toNumber(invoice.grand_total));
    const exposureAfter = round2(exposureBefore + invoiceAmount);
    const exceededBy = round2(exposureAfter - creditLimit);

    if (exceededBy <= 0) return;

    const policy = await this.findPolicy(exceededBy);
    if (!policy) return;

    const existing = await this.findExistingRequest(salesInvoiceId);
    if (existing?.status === 'APPROVED') return;

    if (existing?.status === 'PENDING') {
      throw new BadRequestException(
        `Customer credit limit requires approval before posting. Approval request already pending: ${existing.id}`,
      );
    }

    const requestId = await this.createApprovalRequest({
      invoice,
      policy,
      userId,
      invoiceAmount,
      exposureBefore,
      exposureAfter,
      creditLimit,
      exceededBy,
    });

    throw new BadRequestException(
      `Customer credit limit requires approval before posting. Approval request created: ${requestId}`,
    );
  }

  private async getInvoiceOrThrow(id: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT si.*, c.name AS customer_name, c.credit_limit
      FROM sales_invoices si
      JOIN customers c ON c.id = si.customer_id
      WHERE si.id = $1::uuid
      LIMIT 1
      `,
      id,
    );

    if (!rows[0]) throw new NotFoundException('Sales invoice not found');
    return rows[0];
  }

  private async getCustomerExposure(customerId: string, excludeInvoiceId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      WITH posted_invoices AS (
        SELECT
          si.id,
          GREATEST(0, si.grand_total - si.amount_paid - COALESCE((
            SELECT SUM(sr.grand_total)
            FROM sales_returns sr
            WHERE sr.sales_invoice_id = si.id
              AND sr.status = 'POSTED'
          ), 0)) AS open_amount
        FROM sales_invoices si
        WHERE si.customer_id = $1::uuid
          AND si.id <> $2::uuid
          AND si.status IN ('POSTED', 'PARTIALLY_RETURNED')
      )
      SELECT COALESCE(SUM(open_amount), 0)::numeric AS exposure
      FROM posted_invoices
      `,
      customerId,
      excludeInvoiceId,
    );

    return round2(toNumber(rows[0]?.exposure));
  }

  private async findPolicy(amount: number) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT *
      FROM approval_policies
      WHERE is_active = true
        AND entity_type = 'customers'
        AND action = 'CREDIT_OVERRIDE'
        AND (min_amount IS NULL OR min_amount <= $1)
        AND (max_amount IS NULL OR max_amount >= $1)
      ORDER BY min_amount DESC NULLS LAST
      LIMIT 1
      `,
      amount,
    );

    return rows[0] ?? null;
  }

  private async findExistingRequest(salesInvoiceId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT id, status
      FROM approval_requests
      WHERE entity_type = 'customers'
        AND action = 'CREDIT_OVERRIDE'
        AND metadata->>'salesInvoiceId' = $1
        AND status IN ('PENDING', 'APPROVED')
      ORDER BY requested_at DESC
      LIMIT 1
      `,
      salesInvoiceId,
    );

    return rows[0] ?? null;
  }

  private async createApprovalRequest(input: {
    invoice: any;
    policy: any;
    userId: string;
    invoiceAmount: number;
    exposureBefore: number;
    exposureAfter: number;
    creditLimit: number;
    exceededBy: number;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<any[]>(
        `
        INSERT INTO approval_requests (
          policy_id, entity_type, entity_id, entity_no, action, title, description,
          amount, currency_code, requested_by_id, current_step, required_steps, metadata
        ) VALUES (
          $1::uuid, 'customers', $2::uuid, $3, 'CREDIT_OVERRIDE', $4, $5,
          $6, 'EUR', $7::uuid, 1, $8, $9::jsonb
        )
        RETURNING id
        `,
        input.policy.id,
        input.invoice.customer_id,
        input.invoice.doc_no,
        `Credit override required for invoice ${input.invoice.doc_no}`,
        `Customer ${input.invoice.customer_name} exceeds credit limit before posting invoice ${input.invoice.doc_no}.`,
        input.exceededBy,
        input.userId,
        Number(input.policy.required_steps ?? 1),
        JSON.stringify({
          gate: 'customer-credit-override',
          customerId: input.invoice.customer_id,
          customerName: input.invoice.customer_name,
          salesInvoiceId: input.invoice.id,
          salesInvoiceNo: input.invoice.doc_no,
          invoiceAmount: input.invoiceAmount,
          exposureBefore: input.exposureBefore,
          exposureAfter: input.exposureAfter,
          creditLimit: input.creditLimit,
          exceededBy: input.exceededBy,
        }),
      );

      const requestId = rows[0].id;
      const requiredSteps = Number(input.policy.required_steps ?? 1);
      for (let stepNo = 1; stepNo <= requiredSteps; stepNo += 1) {
        await this.createStepTx(tx, requestId, stepNo, input.policy.id);
      }
      await this.createEventTx(
        tx,
        requestId,
        input.userId,
        `Approval gate created credit override for invoice ${input.invoice.doc_no}`,
      );
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
