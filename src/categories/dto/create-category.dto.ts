import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Lingerie' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'lingerie' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @ApiPropertyOptional({ example: 'Luxury essentials designed for slow rituals.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;
}
