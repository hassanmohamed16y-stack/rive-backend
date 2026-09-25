import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDateString, IsInt, IsOptional, IsString, Min } from "class-validator";

export class GetAuditLogsDto {
  @ApiPropertyOptional({ description: "Filter by User ID" })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: "Filter by action keyword (e.g. order.create, user.update)" })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ description: "Filter by entity type (e.g. Order, Product, User)" })
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional({ description: "Filter by specific entity ID" })
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiPropertyOptional({ description: "Filter logs created on or after ISO date" })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: "Filter logs created on or before ISO date" })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: "Page number (default 1)" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: "Limit items per page (default 20)" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
