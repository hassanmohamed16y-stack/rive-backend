import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

export class UpdateProductVariantDto {
  @ApiPropertyOptional({ example: '#945958' })
  @IsOptional()
  @IsString()
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/)
  colorHex?: string;

  @ApiPropertyOptional({ example: 280 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}
