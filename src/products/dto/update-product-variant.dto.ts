import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Size } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

export class UpdateProductVariantDto {
  @ApiPropertyOptional({ example: 'LUNA-SET-S-BEIGE', maxLength: 128 })
  @IsOptional()
  @IsString()
  @MaxLength(128, { message: 'SKU must be 128 characters or less' })
  sku?: string;

  @ApiPropertyOptional({ example: '#945958' })
  @IsOptional()
  @IsString()
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/)
  colorHex?: string;

  @ApiPropertyOptional({ enum: Size, example: Size.S })
  @IsOptional()
  @IsEnum(Size)
  size?: Size;

  @ApiPropertyOptional({ example: 280 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ example: 12, description: 'Absolute stock value to set. Not a delta/decrement — actual sale-time decrements happen atomically in orders.service.ts.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @ApiProperty({
    example: '2026-09-03T12:00:00.000Z',
    description: 'The variant\'s current updatedAt, as returned by a prior GET/create/update response. ' +
      'Used for optimistic-locking: the update is rejected with 409 Conflict if the variant was modified ' +
      'by someone else in the meantime.',
  })
  @IsDateString()
  expectedUpdatedAt!: string;
}
