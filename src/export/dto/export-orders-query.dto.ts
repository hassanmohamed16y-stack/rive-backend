import { ApiPropertyOptional } from "@nestjs/swagger";
import { OrderStatus } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";

export class ExportOrdersQueryDto {
  @ApiPropertyOptional({ enum: ["csv", "pdf"], default: "csv" })
  @IsOptional()
  @IsString()
  format?: string;

  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

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
