import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class StockMovementQueryDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsUUID()
  itemId?: string;

  @IsOptional()
  @IsIn([
    'PURCHASE_IN',
    'SALE_OUT',
    'SALES_RETURN_IN',
    'ADJUSTMENT_PLUS',
    'ADJUSTMENT_MINUS',
    'TRANSFER_OUT',
    'TRANSFER_IN',
    'COUNT_IN',
    'COUNT_OUT',
  ])
  movementType?: string;
}
