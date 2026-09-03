import { ApiPropertyOptional } from '@nestjs/swagger';
import { Size } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

export class UpdateProductVariantDto {
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

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}
