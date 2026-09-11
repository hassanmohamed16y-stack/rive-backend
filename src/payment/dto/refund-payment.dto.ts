import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Matches,
} from "class-validator";

export class RefundPaymentDto {
  @ApiProperty({
    example: "cm123abc456def",
    description: "The unique order ID to refund",
    minLength: 10,
    maxLength: 128,
  })
  @IsString()
  @IsNotEmpty()
  @Length(10, 128)
  @Matches(/^[A-Za-z0-9_-]+$/)
  orderId!: string;

  @ApiPropertyOptional({
    example: 120.0,
    description:
      "Optional partial amount to refund. If omitted, full order amount is refunded.",
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;
}
