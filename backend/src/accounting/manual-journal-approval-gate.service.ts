import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { round2 } from '../common/utils/money';
import { CreateManualJournalEntryDto } from './dto/create-manual-journal-entry.dto';

function normalized(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

@Injectable()
export class ManualJournalApprovalGateService {
  constructor(private readonly prisma: PrismaService) {}

  async assertCreateAllowed(dto: CreateManualJournalEntryDto, userId: string) {
    const sourceNo = normalized(dto.sourceNo);
    if (!sourceNo) {
      throw new BadRequestException('Manual journal approval requires sourceNo for controlled retry');
    }

    const amount = this.calculateAmount(dto);
    const policy = await this.findPolicy(amount);
    if (!policy) return;

    const existing = await this.findExistingRequest(sourceNo);
    if (existing?.status === 'APPROVED' && !existing.entity_id) return;

    if (existing?.status === 'PENDING') {
      throw new BadRequestException(
        `Manual journal requires approval before posting. Approval request already pending: ${existing.id}`,
      );
    }

    if (existing?.status === 'APPROVED' && existing.entity_id) {
      throw new BadRequestException(
        `Manual journal approval for sourceNo ${sourceNo} is already consumed by journal entry ${existing.entity_id}`,
      );
    }

    const requestId = await this.createApprovalRequest(dto, policy, amount, userId, sourceNo);
    throw new BadRequestException(
      `Manual journal requires approval before posting. Approval request created: ${requestId}`,
    );
  }

  async markConsumed(sourceNo: string | null | undefined, journalEntryId: string) {
    const normalizedSourceNo = normalized(sourceNo);
    if (!normalizedSourceNo) return;

    await this.prisma.$executeRawUnsafe(
      `
      UPDATE approval_requests
      SET entity_id = $2::uuid,
          metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('journalEntryId', $2::text, 'consumedAt', now()::text),
          updated_at = now()
      WHERE entity_type = 'journal-entries'
        AND action = 'POST'
        AND entity_no = $1
        AND status = 'APPROVED'
        AND entity_id IS NULL
      `,
      normalizedSourceNo,
      journalEntryId,
    );
  }

  private calculateAmount(dto: CreateManualJournalEntryDto) {
    const debitTotal = round2(
      dto.lines
        .filter((line) => line.side === 'DEBIT')
        .reduce((sum, line) => sum + Number(line.amount ?? 0), 0),
    );
    const creditTotal = round2(
      dto.lines
        .filter((line) => line.side === 'CREDIT')
        .reduce((sum, line) => sum + Number(line.amount ?? 0), 0),
    );
    return Math.max(debitTotal, creditTotal);
  }

  private async findPolicy(amount: number) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT *
      FROM approval_policies
      WHERE is_active = true
        AND entity_type = 'journal-entries'
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

  private async findExistingRequest(sourceNo: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT id, status, entity_id
      FROM approval_requests
      WHERE entity_type = 'journal-entries'
        AND action = 'POST'
        AND entity_no = $1
        AND status IN ('PENDING', 'APPROVED')
      ORDER BY requested_at DESC
      LIMIT 1
      `,
      sourceNo,
    );

    return rows[0] ?? null;
  }

  private async createApprovalRequest(
    dto: CreateManualJournalEntryDto,
    policy: any,
    amount: number,
    userId: string,
    sourceNo: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<any[]>(
        `
        INSERT INTO approval_requests (
          policy_id, entity_type, entity_id, entity_no, action, title, description,
          amount, currency_code, requested_by_id, current_step, required_steps, metadata
        ) VALUES (
          $1::uuid, 'journal-entries', NULL, $2, 'POST', $3, $4,
          $5, 'EUR', $6::uuid, 1, $7, $8::jsonb
        )
        RETURNING id
        `,
        policy.id,
        sourceNo,
        `Approval required for manual journal ${sourceNo}`,
        dto.description?.trim() || `Manual journal ${sourceNo} requires approval before posting.`,
        amount,
        userId,
        Number(policy.required_steps ?? 1),
        JSON.stringify({
          gate: 'manual-journal-post',
          sourceNo,
          entryDate: dto.entryDate,
          amount,
          lineCount: dto.lines.length,
        }),
      );

      const requestId = rows[0].id;
      const requiredSteps = Number(policy.required_steps ?? 1);
      for (let stepNo = 1; stepNo <= requiredSteps; stepNo += 1) {
        await tx.$executeRawUnsafe(
          `INSERT INTO approval_request_steps (approval_request_id, step_no, status) VALUES ($1::uuid, $2, 'PENDING')`,
          requestId,
          stepNo,
        );
      }
      await tx.$executeRawUnsafe(
        `INSERT INTO approval_request_events (approval_request_id, action, note, created_by_id) VALUES ($1::uuid, 'REQUESTED', $2, $3::uuid)`,
        requestId,
        `Approval gate created request for manual journal ${sourceNo}`,
        userId,
      );
      return requestId;
    });
  }
}
