import { ApiPropertyOptional } from "@nestjs/swagger";
import { PaymentStatus } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";

export class ExportPaymentsQueryDto {
  @ApiPropertyOptional({ enum: ["csv", "pdf"], default: "csv" })
  @IsOptional()
  @IsString()
  format?: string;

  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional({ description: "Start date (ISO or YYYY-MM-DD)" })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: "Alias for startDate" })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: "End date (ISO or YYYY-MM-DD)" })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ description: "Alias for endDate" })
  @IsOptional()
  @IsString()
  to?: string;
}
