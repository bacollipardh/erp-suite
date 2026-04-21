import { Injectable } from '@nestjs/common';
import { PaginationDto } from '../common/dto/pagination.dto';
import { toPaginatedResponse, toPagination } from '../common/utils/pagination';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginationDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { skip, take } = toPagination(page, limit);
    const search = query.search?.trim();

    const where = search
      ? {
          OR: [
            { entityType: { contains: search, mode: 'insensitive' as const } },
            { action: { contains: search, mode: 'insensitive' as const } },
            { entityId: { contains: search, mode: 'insensitive' as const } },
            { user: { fullName: { contains: search, mode: 'insensitive' as const } } },
            { user: { email: { contains: search, mode: 'insensitive' as const } } },
          ],
        }
      : undefined;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: { user: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return toPaginatedResponse({ items, total, page, limit });
  }

  async log(params: {
    userId?: string | null;
    entityType: string;
    entityId: string;
    action: string;
    metadata?: unknown;
  }) {
    return this.prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        metadata: params.metadata as any,
      },
    });
  }
}
