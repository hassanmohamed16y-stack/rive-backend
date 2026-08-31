import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

class OrderItemDto {
  @ApiProperty({ example: 'cm3r5xj4g0000s7d7f1q2n9v' })
  @IsString()
  @IsNotEmpty()
  productVariantId!: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity!: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: 'Aisha Rahman' })
  @IsString()
  @IsNotEmpty()
  customerName!: string;

  @ApiProperty({ example: 'aisha@example.com' })
  @IsEmail()
  customerEmail!: string;

  @ApiPropertyOptional({ example: 'Gift wrap requested' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}
