import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { round2 } from '../common/utils/money';

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

@Injectable()
export class ApprovalsDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard() {
    const [summaryRows, byEntityRows, byStatusRows, agingRows, recentRows, topPendingRows, eventRows] = await Promise.all([
      this.prisma.$queryRawUnsafe<any[]>(`
        SELECT
          COUNT(*)::int AS total_count,
          COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending_count,
          COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS approved_count,
          COUNT(*) FILTER (WHERE status = 'REJECTED')::int AS rejected_count,
          COUNT(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled_count,
          COALESCE(SUM(amount), 0)::numeric AS total_amount,
          COALESCE(SUM(amount) FILTER (WHERE status = 'PENDING'), 0)::numeric AS pending_amount,
          COALESCE(SUM(amount) FILTER (WHERE status = 'APPROVED'), 0)::numeric AS approved_amount,
          COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - requested_at)) / 3600) FILTER (WHERE completed_at IS NOT NULL), 2), 0)::numeric AS avg_resolution_hours,
          COALESCE(MAX(EXTRACT(EPOCH FROM (now() - requested_at)) / 3600) FILTER (WHERE status = 'PENDING'), 0)::numeric AS oldest_pending_hours
        FROM approval_requests
      `),
      this.prisma.$queryRawUnsafe<any[]>(`
        SELECT
          entity_type,
          COUNT(*)::int AS total_count,
          COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending_count,
          COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS approved_count,
          COUNT(*) FILTER (WHERE status = 'REJECTED')::int AS rejected_count,
          COUNT(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled_count,
          COALESCE(SUM(amount), 0)::numeric AS total_amount,
          COALESCE(SUM(amount) FILTER (WHERE status = 'PENDING'), 0)::numeric AS pending_amount
        FROM approval_requests
        GROUP BY entity_type
        ORDER BY pending_count DESC, total_amount DESC, entity_type ASC
      `),
      this.prisma.$queryRawUnsafe<any[]>(`
        SELECT status, COUNT(*)::int AS count, COALESCE(SUM(amount), 0)::numeric AS amount
        FROM approval_requests
        GROUP BY status
        ORDER BY status ASC
      `),
      this.prisma.$queryRawUnsafe<any[]>(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'PENDING' AND requested_at >= now() - interval '4 hours')::int AS lt4h,
          COUNT(*) FILTER (WHERE status = 'PENDING' AND requested_at < now() - interval '4 hours' AND requested_at >= now() - interval '24 hours')::int AS h4to24,
          COUNT(*) FILTER (WHERE status = 'PENDING' AND requested_at < now() - interval '24 hours' AND requested_at >= now() - interval '72 hours')::int AS d1to3,
          COUNT(*) FILTER (WHERE status = 'PENDING' AND requested_at < now() - interval '72 hours')::int AS over3d
        FROM approval_requests
      `),
      this.prisma.$queryRawUnsafe<any[]>(`
        SELECT r.*, p.code AS policy_code, p.name AS policy_name, u.full_name AS requested_by_name, u.email AS requested_by_email
        FROM approval_requests r
        LEFT JOIN approval_policies p ON p.id = r.policy_id
        LEFT JOIN users u ON u.id = r.requested_by_id
        ORDER BY r.requested_at DESC
        LIMIT 12
      `),
      this.prisma.$queryRawUnsafe<any[]>(`
        SELECT r.*, p.code AS policy_code, p.name AS policy_name, u.full_name AS requested_by_name, u.email AS requested_by_email
        FROM approval_requests r
        LEFT JOIN approval_policies p ON p.id = r.policy_id
        LEFT JOIN users u ON u.id = r.requested_by_id
        WHERE r.status = 'PENDING'
        ORDER BY r.amount DESC, r.requested_at ASC
        LIMIT 10
      `),
      this.prisma.$queryRawUnsafe<any[]>(`
        SELECT e.id, e.action, e.note, e.created_at, u.full_name AS created_by_name,
               r.id AS request_id, r.title, r.entity_type, r.entity_no, r.status
        FROM approval_request_events e
        JOIN approval_requests r ON r.id = e.approval_request_id
        LEFT JOIN users u ON u.id = e.created_by_id
        ORDER BY e.created_at DESC
        LIMIT 14
      `),
    ]);

    const summary = this.mapSummary(summaryRows[0] ?? {});

    return {
      summary,
      byEntity: byEntityRows.map((row) => ({
        entityType: row.entity_type,
        totalCount: toNumber(row.total_count),
        pendingCount: toNumber(row.pending_count),
        approvedCount: toNumber(row.approved_count),
        rejectedCount: toNumber(row.rejected_count),
        cancelledCount: toNumber(row.cancelled_count),
        totalAmount: round2(toNumber(row.total_amount)),
        pendingAmount: round2(toNumber(row.pending_amount)),
      })),
      byStatus: byStatusRows.map((row) => ({
        status: row.status,
        count: toNumber(row.count),
        amount: round2(toNumber(row.amount)),
      })),
      aging: {
        lt4h: toNumber(agingRows[0]?.lt4h),
        h4to24: toNumber(agingRows[0]?.h4to24),
        d1to3: toNumber(agingRows[0]?.d1to3),
        over3d: toNumber(agingRows[0]?.over3d),
      },
      recentRequests: recentRows.map((row) => this.mapRequest(row)),
      topPending: topPendingRows.map((row) => this.mapRequest(row)),
      recentEvents: eventRows.map((row) => ({
        id: row.id,
        action: row.action,
        note: row.note ?? null,
        createdAt: row.created_at,
        createdByName: row.created_by_name ?? null,
        requestId: row.request_id,
        title: row.title,
        entityType: row.entity_type,
        entityNo: row.entity_no ?? null,
        status: row.status,
      })),
      generatedAt: new Date().toISOString(),
    };
  }

  private mapSummary(row: any) {
    return {
      totalCount: toNumber(row.total_count),
      pendingCount: toNumber(row.pending_count),
      approvedCount: toNumber(row.approved_count),
      rejectedCount: toNumber(row.rejected_count),
      cancelledCount: toNumber(row.cancelled_count),
      totalAmount: round2(toNumber(row.total_amount)),
      pendingAmount: round2(toNumber(row.pending_amount)),
      approvedAmount: round2(toNumber(row.approved_amount)),
      avgResolutionHours: round2(toNumber(row.avg_resolution_hours)),
      oldestPendingHours: round2(toNumber(row.oldest_pending_hours)),
    };
  }

  private mapRequest(row: any) {
    return {
      id: row.id,
      policyId: row.policy_id ?? null,
      policyCode: row.policy_code ?? null,
      policyName: row.policy_name ?? null,
      entityType: row.entity_type,
      entityId: row.entity_id ?? null,
      entityNo: row.entity_no ?? null,
      action: row.action,
      title: row.title,
      description: row.description ?? null,
      amount: round2(toNumber(row.amount)),
      currencyCode: row.currency_code ?? 'EUR',
      status: row.status,
      requestedByName: row.requested_by_name ?? null,
      requestedByEmail: row.requested_by_email ?? null,
      currentStep: toNumber(row.current_step),
      requiredSteps: toNumber(row.required_steps),
      requestedAt: row.requested_at,
      completedAt: row.completed_at ?? null,
      updatedAt: row.updated_at,
    };
  }
}
