import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class ExportCustomersQueryDto {
  @ApiPropertyOptional({ enum: ["csv"], default: "csv" })
  @IsOptional()
  @IsString()
  format?: string;

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
