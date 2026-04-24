import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StatementsController } from './statements.controller';
import { StatementsService } from './statements.service';

@Module({
  imports: [PrismaModule],
  controllers: [StatementsController],
  providers: [StatementsService],
})
export class StatementsModule {}
