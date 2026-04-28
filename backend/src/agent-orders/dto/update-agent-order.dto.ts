import { PartialType } from '@nestjs/mapped-types';
import { CreateAgentOrderDto } from './create-agent-order.dto';

export class UpdateAgentOrderDto extends PartialType(CreateAgentOrderDto) {}
