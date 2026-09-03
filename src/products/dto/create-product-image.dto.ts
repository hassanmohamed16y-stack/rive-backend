import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateProductImageDto {
  @ApiProperty({ example: 'https://images.example.com/product-1.png', maxLength: 2048 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048, { message: 'Image URL must be 2048 characters or less' })
  url!: string;

  @ApiPropertyOptional({ example: 'Luna silk set front view', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Alt text must be 500 characters or less' })
  altText?: string;

  @ApiPropertyOptional({ example: true, default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
