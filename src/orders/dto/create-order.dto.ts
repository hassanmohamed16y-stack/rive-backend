import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { PaymentMethod } from "@prisma/client";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

class OrderItemDto {
  @ApiProperty({ example: "cm3r5xj4g0000s7d7f1q2n9v" })
  @IsString()
  @IsNotEmpty()
  @Length(10, 128)
  productVariantId!: string;

  @ApiProperty({ example: 1, minimum: 1, maximum: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  quantity!: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: "Aisha Rahman", minLength: 2, maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @Length(2, 120)
  customerName!: string;

  @ApiProperty({ example: "aisha@example.com", maxLength: 254 })
  @IsEmail()
  @IsString()
  @IsNotEmpty()
  @Length(3, 254)
  customerEmail!: string;

  @ApiPropertyOptional({ example: "123 Nile Street", maxLength: 255 })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  shippingAddress?: string;

  @ApiPropertyOptional({ example: "Cairo", maxLength: 100 })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  shippingCity?: string;

  @ApiPropertyOptional({ example: "Egypt", maxLength: 100 })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  shippingCountry?: string;

  @ApiProperty({ example: "+201000000000", maxLength: 30 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 30)
  shippingPhone!: string;

  @ApiPropertyOptional({ example: "11511", maxLength: 20 })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  shippingZipCode?: string;

  @ApiPropertyOptional({ example: "Gift wrap requested", maxLength: 500 })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;

  @ApiPropertyOptional({ example: "idemp_1234567890", maxLength: 255 })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  idempotencyKey?: string;

  @ApiPropertyOptional({ example: "SUMMER20", maxLength: 50 })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  couponCode?: string;

  @ApiPropertyOptional({ enum: PaymentMethod, example: PaymentMethod.ONLINE })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiProperty({ type: [OrderItemDto], maxItems: 50 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}
