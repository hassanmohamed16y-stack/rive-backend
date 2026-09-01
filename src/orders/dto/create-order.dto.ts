import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

class OrderItemDto {
  @ApiProperty({ example: 'cm3r5xj4g0000s7d7f1q2n9v' })
  @IsString()
  @IsNotEmpty()
  @Length(10, 128)
  productVariantId!: string;

  @ApiProperty({ example: 1, minimum: 1, maximum: 50 })
  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(1)
  @Max(50)
  quantity!: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: 'Aisha Rahman', minLength: 2, maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @Length(2, 120)
  customerName!: string;

  @ApiProperty({ example: 'aisha@example.com', maxLength: 254 })
  @IsEmail()
  @IsString()
  @IsNotEmpty()
  @Length(3, 254)
  customerEmail!: string;

  @ApiPropertyOptional({ example: 'Gift wrap requested', maxLength: 500 })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;

  @ApiProperty({ type: [OrderItemDto], maxItems: 50 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}
