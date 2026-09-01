import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Lingerie', maxLength: 256 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256, { message: 'Category name must be 256 characters or less' })
  name!: string;

  @ApiProperty({ example: 'lingerie', maxLength: 256 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 256, { message: 'Slug must be between 1 and 256 characters' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @ApiPropertyOptional({ example: 'Luxury essentials designed for slow rituals.', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Description must be 1000 characters or less' })
  description?: string;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;
}
