import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsPositive } from "class-validator";

export class RefundOrderDto {
  @ApiPropertyOptional({
    example: 120.0,
    description: "Optional partial amount to refund. If omitted, full order amount is refunded.",
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;
}
