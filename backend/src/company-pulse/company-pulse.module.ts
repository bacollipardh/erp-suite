import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CompanyPulseController } from './company-pulse.controller';
import { CompanyPulseService } from './company-pulse.service';

@Module({
  imports: [PrismaModule],
  controllers: [CompanyPulseController],
  providers: [CompanyPulseService],
})
export class CompanyPulseModule {}
