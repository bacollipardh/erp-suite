import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { round2 } from '../common/utils/money';

type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
type StepStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED';
type FindRequestsQuery = { status?: string; scope?: string; search?: string; limit?: string; overdueOnly?: string };
type CreateApprovalRequestBody = { entityType: string; entityId?: string; entityNo?: string; action: string; title: string; description?: string; amount?: number; currencyCode?: string; metadata?: Record<string, unknown> };

const STATUSES: ApprovalStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];
const DEFAULT_SLA_HOURS = 24;

function normalize(value?: string | null) { const result = value?.trim(); return result ? result : null; }
function normalizeStatus(value?: string): ApprovalStatus | null { const normalized = value?.trim().toUpperCase(); return STATUSES.includes(normalized as ApprovalStatus) ? (normalized as ApprovalStatus) : null; }
function parseLimit(value?: string) { const parsed = Number(value ?? 50); if (!Number.isFinite(parsed)) return 50; return Math.max(1, Math.min(200, Math.trunc(parsed))); }
function assertUuidOrNull(value?: string | null) { const normalized = normalize(value); if (!normalized) return null; if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) throw new BadRequestException('entityId must be a UUID'); return normalized; }

@Injectable()
export class ApprovalsService {
  constructor(private readonly prisma: PrismaService) {}

  async findPolicies() {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT id, code, name, entity_type, action, min_amount, max_amount, required_steps, is_active, created_at, updated_at FROM approval_policies ORDER BY entity_type ASC, action ASC, min_amount NULLS FIRST`);
    return { items: rows.map((row) => this.mapPolicy(row)), total: rows.length };
  }

  async findRequests(query: FindRequestsQuery = {}, userId?: string) {
    const status = normalizeStatus(query.status);
    const scope = normalize(query.scope)?.toLowerCase() ?? null;
    const search = normalize(query.search);
    const limit = parseLimit(query.limit);
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT r.*, p.code AS policy_code, p.name AS policy_name, u.full_name AS requested_by_name, u.email AS requested_by_email
      FROM approval_requests r
      LEFT JOIN approval_policies p ON p.id = r.policy_id
      LEFT JOIN users u ON u.id = r.requested_by_id
      WHERE ($1::text IS NULL OR r.status = $1)
        AND ($2::text IS NULL OR r.title ILIKE '%' || $2 || '%' OR r.entity_no ILIKE '%' || $2 || '%' OR r.entity_type ILIKE '%' || $2 || '%')
        AND ($3::text IS NULL OR $3 NOT IN ('mine','created_by_me') OR r.requested_by_id = $4::uuid)
        AND ($3::text IS NULL OR $3 NOT IN ('for_me','my_approvals') OR (
          r.status = 'PENDING' AND EXISTS (
            SELECT 1 FROM approval_request_steps s
            JOIN users cu ON cu.id = $4::uuid
            JOIN roles cr ON cr.id = cu.role_id
            WHERE s.approval_request_id = r.id
              AND s.step_no = r.current_step
              AND s.status = 'PENDING'
              AND (s.approver_user_id IS NULL OR s.approver_user_id = $4::uuid)
              AND (s.approver_role_code IS NULL OR UPPER(s.approver_role_code) = UPPER(cr.code))
          )
        ))
      ORDER BY CASE WHEN r.status = 'PENDING' THEN 0 ELSE 1 END, r.requested_at DESC
      LIMIT $5
      `,
      status, search, scope, userId ?? null, limit,
    );
    const summaryRows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT status, COUNT(*)::int AS count FROM approval_requests GROUP BY status`);
    const summary = { total: 0, pending: 0, approved: 0, rejected: 0, cancelled: 0 };
    for (const row of summaryRows) { const key = String(row.status).toLowerCase() as 'pending' | 'approved' | 'rejected' | 'cancelled'; summary[key] = Number(row.count ?? 0); summary.total += Number(row.count ?? 0); }
    return { items: rows.map((row) => this.mapRequest(row)), total: rows.length, summary, appliedFilters: { status, scope, search, limit } };
  }

  async getPendingBadge(userId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT
        COUNT(*) FILTER (WHERE r.status = 'PENDING')::int AS pending_all,
        COUNT(*) FILTER (WHERE r.status = 'PENDING' AND r.is_escalated = true)::int AS escalated_all,
        COUNT(*) FILTER (WHERE r.status = 'PENDING' AND EXTRACT(EPOCH FROM (now() - r.requested_at)) / 3600 > COALESCE(p.sla_hours, $2))::int AS overdue_all,
        COUNT(*) FILTER (WHERE r.status = 'PENDING' AND EXISTS (
          SELECT 1 FROM approval_request_steps s
          JOIN users cu ON cu.id = $1::uuid
          JOIN roles cr ON cr.id = cu.role_id
          WHERE s.approval_request_id = r.id
            AND s.step_no = r.current_step
            AND s.status = 'PENDING'
            AND (s.approver_user_id IS NULL OR s.approver_user_id = $1::uuid)
            AND (s.approver_role_code IS NULL OR UPPER(s.approver_role_code) = UPPER(cr.code))
        ))::int AS pending_for_me
      FROM approval_requests r
      LEFT JOIN approval_policies p ON p.id = r.policy_id
      `,
      userId, DEFAULT_SLA_HOURS,
    );
    return {
      pendingAll: Number(rows[0]?.pending_all ?? 0),
      pendingForMe: Number(rows[0]?.pending_for_me ?? 0),
      overdueAll: Number(rows[0]?.overdue_all ?? 0),
      escalatedAll: Number(rows[0]?.escalated_all ?? 0),
      slaHours: DEFAULT_SLA_HOURS,
    };
  }

  async findOne(id: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT r.*, p.code AS policy_code, p.name AS policy_name, u.full_name AS requested_by_name, u.email AS requested_by_email FROM approval_requests r LEFT JOIN approval_policies p ON p.id = r.policy_id LEFT JOIN users u ON u.id = r.requested_by_id WHERE r.id = $1::uuid`, id);
    if (!rows[0]) throw new NotFoundException('Approval request not found');
    const [stepRows, eventRows] = await Promise.all([
      this.prisma.$queryRawUnsafe<any[]>(`SELECT s.*, au.full_name AS approver_user_name, au.email AS approver_user_email, du.full_name AS decided_by_name FROM approval_request_steps s LEFT JOIN users au ON au.id = s.approver_user_id LEFT JOIN users du ON du.id = s.decided_by_id WHERE s.approval_request_id = $1::uuid ORDER BY s.step_no ASC`, id),
      this.prisma.$queryRawUnsafe<any[]>(`SELECT e.*, u.full_name AS created_by_name FROM approval_request_events e JOIN users u ON u.id = e.created_by_id WHERE e.approval_request_id = $1::uuid ORDER BY e.created_at DESC`, id),
    ]);
    return { ...this.mapRequest(rows[0]), steps: stepRows.map((row) => this.mapStep(row)), events: eventRows.map((row) => this.mapEvent(row)) };
  }

  async createRequest(body: CreateApprovalRequestBody, requestedById: string) {
    const entityType = normalize(body.entityType); const action = normalize(body.action)?.toUpperCase() ?? null; const title = normalize(body.title); const entityId = assertUuidOrNull(body.entityId); const entityNo = normalize(body.entityNo); const description = normalize(body.description); const amount = round2(Number(body.amount ?? 0)); const currencyCode = normalize(body.currencyCode) ?? 'EUR';
    if (!entityType) throw new BadRequestException('entityType is required'); if (!action) throw new BadRequestException('action is required'); if (!title) throw new BadRequestException('title is required'); if (!Number.isFinite(amount) || amount < 0) throw new BadRequestException('amount must be positive');
    return this.prisma.$transaction(async (tx) => {
      const policy = await this.findMatchingPolicyTx(tx, entityType, action, amount); const requiredSteps = Number(policy?.required_steps ?? 1);

      // Auto-approve: policy flagged as auto_approve = true
      if (policy && Boolean(policy.auto_approve)) {
        const rows = await tx.$queryRawUnsafe<any[]>(
          `INSERT INTO approval_requests (policy_id, entity_type, entity_id, entity_no, action, title, description, amount, currency_code, requested_by_id, current_step, required_steps, status, completed_at, metadata) VALUES ($1::uuid, $2, $3::uuid, $4, $5, $6, $7, $8, $9, $10::uuid, 1, $11, 'APPROVED', now(), $12::jsonb) RETURNING *`,
          policy.id, entityType, entityId, entityNo, action, title, description, amount, currencyCode, requestedById, requiredSteps, JSON.stringify(body.metadata ?? {}),
        );
        const request = rows[0];
        await this.addEventTx(tx, request.id, 'REQUESTED', description, requestedById);
        await this.addEventTx(tx, request.id, 'AUTO_APPROVED', `Aprovuar automatikisht sipas politikës "${policy.name}"`, requestedById);
        return { ...this.mapRequest(request), autoApproved: true };
      }

      const rows = await tx.$queryRawUnsafe<any[]>(`INSERT INTO approval_requests (policy_id, entity_type, entity_id, entity_no, action, title, description, amount, currency_code, requested_by_id, current_step, required_steps, metadata) VALUES ($1::uuid, $2, $3::uuid, $4, $5, $6, $7, $8, $9, $10::uuid, 1, $11, $12::jsonb) RETURNING *`, policy?.id ?? null, entityType, entityId, entityNo, action, title, description, amount, currencyCode, requestedById, requiredSteps, JSON.stringify(body.metadata ?? {}));
      const request = rows[0]; for (let stepNo = 1; stepNo <= requiredSteps; stepNo += 1) await this.addStepTx(tx, request.id, stepNo, policy?.id ?? null);
      await this.addEventTx(tx, request.id, 'REQUESTED', description, requestedById); return this.mapRequest(request);
    });
  }

  async escalate(id: string, note: string | undefined, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const request = await this.lockRequestTx(tx, id);
      if (request.status !== 'PENDING') throw new BadRequestException('Vetëm kërkesat PENDING mund të eskalojnë');
      if (Boolean(request.is_escalated)) throw new BadRequestException('Kërkesa është tashmë e eskaluar');
      const rows = await tx.$queryRawUnsafe<any[]>(
        `UPDATE approval_requests SET is_escalated = true, escalated_at = now(), escalated_by_id = $2::uuid, updated_at = now() WHERE id = $1::uuid RETURNING *`,
        id, userId,
      );
      await this.addEventTx(tx, id, 'ESCALATED', normalize(note) ?? 'Eskaluar për rishikim urgjent', userId);
      return this.mapRequest(rows[0]);
    });
  }

  async getOverdueRequests() {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT r.*, p.code AS policy_code, p.name AS policy_name,
             COALESCE(p.sla_hours, $1) AS effective_sla_hours,
             u.full_name AS requested_by_name, u.email AS requested_by_email
      FROM approval_requests r
      LEFT JOIN approval_policies p ON p.id = r.policy_id
      LEFT JOIN users u ON u.id = r.requested_by_id
      WHERE r.status = 'PENDING'
        AND EXTRACT(EPOCH FROM (now() - r.requested_at)) / 3600 > COALESCE(p.sla_hours, $1)
      ORDER BY r.requested_at ASC
    `, DEFAULT_SLA_HOURS);
    return { items: rows.map((row) => this.mapRequest(row)), total: rows.length };
  }

  async getPolicyActiveRequestCount(policyId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*)::int AS count FROM approval_requests WHERE policy_id = $1::uuid AND status = 'PENDING'`,
      policyId,
    );
    return { policyId, pendingCount: Number(rows[0]?.count ?? 0) };
  }

  async approve(id: string, note: string | undefined, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const request = await this.lockRequestTx(tx, id); if (request.status !== 'PENDING') throw new BadRequestException('Approval request is not pending');
      const stepRows = await tx.$queryRawUnsafe<any[]>(`SELECT * FROM approval_request_steps WHERE approval_request_id = $1::uuid AND step_no = $2 FOR UPDATE`, id, request.current_step);
      const step = stepRows[0]; if (!step || step.status !== 'PENDING') throw new BadRequestException('Current approval step is not pending'); await this.assertStepApproverAllowedTx(tx, step, userId); this.assertNoSelfApproval(request, userId);
      await tx.$executeRawUnsafe(`UPDATE approval_request_steps SET status = 'APPROVED', decided_by_id = $3::uuid, decision_note = $4, decided_at = now() WHERE approval_request_id = $1::uuid AND step_no = $2`, id, request.current_step, userId, normalize(note));
      await this.addEventTx(tx, id, 'APPROVED_STEP', normalize(note), userId);
      if (Number(request.current_step) >= Number(request.required_steps)) { const rows = await tx.$queryRawUnsafe<any[]>(`UPDATE approval_requests SET status = 'APPROVED', completed_at = now(), updated_at = now() WHERE id = $1::uuid RETURNING *`, id); await this.addEventTx(tx, id, 'APPROVED', normalize(note), userId); return this.mapRequest(rows[0]); }
      const rows = await tx.$queryRawUnsafe<any[]>(`UPDATE approval_requests SET current_step = current_step + 1, updated_at = now() WHERE id = $1::uuid RETURNING *`, id); return this.mapRequest(rows[0]);
    });
  }

  async reject(id: string, note: string | undefined, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const request = await this.lockRequestTx(tx, id); if (request.status !== 'PENDING') throw new BadRequestException('Approval request is not pending');
      const stepRows = await tx.$queryRawUnsafe<any[]>(`SELECT * FROM approval_request_steps WHERE approval_request_id = $1::uuid AND step_no = $2 FOR UPDATE`, id, request.current_step);
      const step = stepRows[0]; if (!step || step.status !== 'PENDING') throw new BadRequestException('Current approval step is not pending'); await this.assertStepApproverAllowedTx(tx, step, userId);
      await tx.$executeRawUnsafe(`UPDATE approval_request_steps SET status = 'REJECTED', decided_by_id = $3::uuid, decision_note = $4, decided_at = now() WHERE approval_request_id = $1::uuid AND step_no = $2 AND status = 'PENDING'`, id, request.current_step, userId, normalize(note));
      const rows = await tx.$queryRawUnsafe<any[]>(`UPDATE approval_requests SET status = 'REJECTED', completed_at = now(), updated_at = now() WHERE id = $1::uuid RETURNING *`, id); await this.addEventTx(tx, id, 'REJECTED', normalize(note), userId); return this.mapRequest(rows[0]);
    });
  }

  async cancel(id: string, note: string | undefined, userId: string) { return this.prisma.$transaction(async (tx) => { const request = await this.lockRequestTx(tx, id); if (request.status !== 'PENDING') throw new BadRequestException('Only pending approvals can be cancelled'); const rows = await tx.$queryRawUnsafe<any[]>(`UPDATE approval_requests SET status = 'CANCELLED', completed_at = now(), updated_at = now() WHERE id = $1::uuid RETURNING *`, id); await this.addEventTx(tx, id, 'CANCELLED', normalize(note), userId); return this.mapRequest(rows[0]); }); }
  async comment(id: string, note: string | undefined, userId: string) { if (!normalize(note)) throw new BadRequestException('note is required'); await this.ensureRequestExists(id); await this.prisma.$executeRawUnsafe(`INSERT INTO approval_request_events (approval_request_id, action, note, created_by_id) VALUES ($1::uuid, 'COMMENT', $2, $3::uuid)`, id, normalize(note), userId); return this.findOne(id); }

  private assertNoSelfApproval(request: any, userId: string) { if (String(request.requested_by_id ?? '').toLowerCase() === String(userId).toLowerCase()) throw new ForbiddenException('Self-approval is not allowed for this approval request'); }
  private async findMatchingPolicyTx(tx: Prisma.TransactionClient, entityType: string, action: string, amount: number) { const rows = await tx.$queryRawUnsafe<any[]>(`SELECT * FROM approval_policies WHERE is_active = true AND entity_type = $1 AND action = $2 AND (min_amount IS NULL OR min_amount <= $3) AND (max_amount IS NULL OR max_amount >= $3) ORDER BY min_amount DESC NULLS LAST LIMIT 1`, entityType, action, amount); return rows[0] ?? null; }
  private async lockRequestTx(tx: Prisma.TransactionClient, id: string) { const rows = await tx.$queryRawUnsafe<any[]>(`SELECT * FROM approval_requests WHERE id = $1::uuid FOR UPDATE`, id); if (!rows[0]) throw new NotFoundException('Approval request not found'); return rows[0]; }
  private async ensureRequestExists(id: string) { const rows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT id FROM approval_requests WHERE id = $1::uuid`, id); if (!rows[0]) throw new NotFoundException('Approval request not found'); }
  private async assertStepApproverAllowedTx(tx: Prisma.TransactionClient, step: any, userId: string) { const approverUserId = normalize(step.approver_user_id); const approverRoleCode = normalize(step.approver_role_code)?.toUpperCase() ?? null; if (!approverUserId && !approverRoleCode) return; const rows = await tx.$queryRawUnsafe<any[]>(`SELECT u.id, u.full_name, u.email, r.code AS role_code FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1::uuid AND u.is_active = true LIMIT 1`, userId); const user = rows[0]; if (!user) throw new ForbiddenException('Active approver user not found'); if (approverUserId && String(approverUserId).toLowerCase() !== String(userId).toLowerCase()) throw new ForbiddenException('This approval step is assigned to a specific approver user'); if (!approverUserId && approverRoleCode && String(user.role_code ?? '').toUpperCase() !== approverRoleCode) throw new ForbiddenException(`This approval step requires role ${approverRoleCode}`); }
  private async addStepTx(tx: Prisma.TransactionClient, requestId: string, stepNo: number, policyId: string | null) { await tx.$executeRawUnsafe(`INSERT INTO approval_request_steps (approval_request_id, step_no, status, approver_role_code, approver_user_id) SELECT $1::uuid, $2, 'PENDING', ps.approver_role_code, ps.approver_user_id FROM approval_policy_steps ps WHERE ps.policy_id = $3::uuid AND ps.step_no = $2 UNION ALL SELECT $1::uuid, $2, 'PENDING', NULL, NULL WHERE $3::uuid IS NULL OR NOT EXISTS (SELECT 1 FROM approval_policy_steps ps WHERE ps.policy_id = $3::uuid AND ps.step_no = $2)`, requestId, stepNo, policyId); }
  private async addEventTx(tx: Prisma.TransactionClient, requestId: string, action: string, note: string | null, userId: string) { await tx.$executeRawUnsafe(`INSERT INTO approval_request_events (approval_request_id, action, note, created_by_id) VALUES ($1::uuid, $2, $3, $4::uuid)`, requestId, action, note, userId); }
  private mapPolicy(row: any) { return { id: row.id, code: row.code, name: row.name, entityType: row.entity_type, action: row.action, minAmount: row.min_amount === null ? null : round2(Number(row.min_amount)), maxAmount: row.max_amount === null ? null : round2(Number(row.max_amount)), requiredSteps: Number(row.required_steps ?? 1), slaHours: Number(row.sla_hours ?? DEFAULT_SLA_HOURS), autoApprove: Boolean(row.auto_approve), isActive: Boolean(row.is_active), createdAt: row.created_at, updatedAt: row.updated_at }; }
  private mapRequest(row: any) {
    const effectiveSla = Number(row.effective_sla_hours ?? row.sla_hours ?? DEFAULT_SLA_HOURS);
    const ageHours = row.status === 'PENDING' ? round2((Date.now() - new Date(row.requested_at).getTime()) / 3600000) : 0;
    return { id: row.id, policyId: row.policy_id ?? null, policyCode: row.policy_code ?? null, policyName: row.policy_name ?? null, entityType: row.entity_type, entityId: row.entity_id ?? null, entityNo: row.entity_no ?? null, action: row.action, title: row.title, description: row.description ?? null, amount: round2(Number(row.amount ?? 0)), currencyCode: row.currency_code ?? 'EUR', status: row.status, requestedById: row.requested_by_id, requestedByName: row.requested_by_name ?? null, requestedByEmail: row.requested_by_email ?? null, currentStep: Number(row.current_step ?? 1), requiredSteps: Number(row.required_steps ?? 1), metadata: row.metadata ?? {}, requestedAt: row.requested_at, completedAt: row.completed_at ?? null, updatedAt: row.updated_at, ageHours, isOverdue: row.status === 'PENDING' && ageHours > effectiveSla, isEscalated: Boolean(row.is_escalated), escalatedAt: row.escalated_at ?? null, slaHours: effectiveSla };
  }
  private mapStep(row: any) { return { id: row.id, stepNo: Number(row.step_no), status: row.status as StepStatus, approverRoleCode: row.approver_role_code ?? null, approverUserId: row.approver_user_id ?? null, approverUserName: row.approver_user_name ?? null, approverUserEmail: row.approver_user_email ?? null, decidedById: row.decided_by_id ?? null, decidedByName: row.decided_by_name ?? null, decisionNote: row.decision_note ?? null, decidedAt: row.decided_at ?? null, createdAt: row.created_at }; }
  private mapEvent(row: any) { return { id: row.id, action: row.action, note: row.note ?? null, createdById: row.created_by_id, createdByName: row.created_by_name ?? null, createdAt: row.created_at }; }
}
