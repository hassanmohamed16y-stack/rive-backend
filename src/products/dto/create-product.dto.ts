import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductStatus, Size } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

class ProductImageDto {
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

class ProductVariantDto {
  @ApiProperty({ example: 'LUNA-SET-S-BEIGE', maxLength: 128 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128, { message: 'SKU must be 128 characters or less' })
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

  @ApiPropertyOptional({ example: 12, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}

export class CreateProductDto {
  @ApiProperty({ example: 'Luna Silk Set', maxLength: 256 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256, { message: 'Product name must be 256 characters or less' })
  name!: string;

  @ApiProperty({ example: 'luna-silk-set', maxLength: 256 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 256, { message: 'Slug must be between 1 and 256 characters' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @ApiPropertyOptional({ example: 'A sculptural layering piece made for evening rituals.', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Description must be 2000 characters or less' })
  description?: string;

  @ApiPropertyOptional({ example: 'Soft-touch, lightweight luxury.', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Short description must be 500 characters or less' })
  shortDescription?: string;

  @ApiProperty({ example: 280 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @ApiPropertyOptional({ example: 360 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  compareAtPrice?: number;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ enum: ProductStatus, example: ProductStatus.ACTIVE })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiProperty({ example: 'lingerie', maxLength: 256 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256, { message: 'Category slug must be 256 characters or less' })
  categorySlug!: string;

  @ApiProperty({ type: [ProductImageDto], maxItems: 20 })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one product image is required' })
  @ArrayMaxSize(20, { message: 'Maximum 20 product images allowed' })
  @ValidateNested({ each: true })
  @Type(() => ProductImageDto)
  images!: ProductImageDto[];

  @ApiProperty({ type: [ProductVariantDto], maxItems: 100 })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one product variant is required' })
  @ArrayMaxSize(100, { message: 'Maximum 100 product variants allowed' })
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variants!: ProductVariantDto[];
}
