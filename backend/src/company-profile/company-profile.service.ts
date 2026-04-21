import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertCompanyProfileDto } from './dto/upsert-company-profile.dto';

// Singleton row ID — we always upsert the same record
const PROFILE_ID = '00000000-0000-0000-0000-000000000001';

@Injectable()
export class CompanyProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    return this.prisma.companyProfile.findUnique({ where: { id: PROFILE_ID } });
  }

  async upsert(dto: UpsertCompanyProfileDto) {
    const data = {
      ...dto,
      fiscalMode: dto.fiscalMode,
    };

    return this.prisma.companyProfile.upsert({
      where: { id: PROFILE_ID },
      create: { id: PROFILE_ID, ...data },
      update: data,
    });
  }
}
