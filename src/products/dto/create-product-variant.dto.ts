import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Size } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

export class CreateProductVariantDto {
  @ApiProperty({ example: 'LUNA-SET-S-BEIGE', maxLength: 128 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  sku!: string;

  @ApiPropertyOptional({ example: '#945958', default: '#945958' })
  @IsOptional()
  @IsString()
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/)
  colorHex?: string;

  @ApiProperty({ enum: Size, example: Size.S })
  @IsEnum(Size)
  size!: Size;

  @ApiProperty({ example: 280 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @ApiProperty({ example: 12 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stock!: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}
