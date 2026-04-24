import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ControlTowerController } from './control-tower.controller';
import { ControlTowerService } from './control-tower.service';

@Module({
  imports: [PrismaModule],
  controllers: [ControlTowerController],
  providers: [ControlTowerService],
})
export class ControlTowerModule {}
