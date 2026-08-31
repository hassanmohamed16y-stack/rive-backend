import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductStatus, Size } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

class ProductImageDto {
  @ApiProperty({ example: 'https://images.example.com/product-1.png' })
  @IsString()
  @IsNotEmpty()
  url!: string;

  @ApiPropertyOptional({ example: 'Luna silk set front view' })
  @IsOptional()
  @IsString()
  altText?: string;

  @ApiPropertyOptional({ example: true, default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

class ProductVariantDto {
  @ApiProperty({ example: 'LUNA-SET-S-BEIGE' })
  @IsString()
  @IsNotEmpty()
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
  @ApiProperty({ example: 'Luna Silk Set' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'luna-silk-set' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @ApiPropertyOptional({ example: 'A sculptural layering piece made for evening rituals.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Soft-touch, lightweight luxury.' })
  @IsOptional()
  @IsString()
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

  @ApiProperty({ example: 'lingerie' })
  @IsString()
  @IsNotEmpty()
  categorySlug!: string;

  @ApiProperty({ type: [ProductImageDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one product image is required' })
  @ValidateNested({ each: true })
  @Type(() => ProductImageDto)
  images!: ProductImageDto[];

  @ApiProperty({ type: [ProductVariantDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one product variant is required' })
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variants!: ProductVariantDto[];
}
