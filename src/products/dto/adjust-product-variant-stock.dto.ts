import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, MaxLength, NotEquals } from 'class-validator';

export class AdjustProductVariantStockDto {
  @ApiProperty({ example: -2, description: 'Stock delta; negative values remove stock.' })
  @Type(() => Number)
  @IsInt()
  @NotEquals(0)
  adjustment!: number;

  @ApiProperty({ example: 'Damaged inventory reconciliation', maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
