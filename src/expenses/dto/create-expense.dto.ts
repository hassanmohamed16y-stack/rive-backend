import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateExpenseDto {
  @ApiProperty({ example: "Fabric Materials Purchase" })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ example: "Materials" })
  @IsString()
  @IsNotEmpty()
  category!: string;

  @ApiProperty({ example: 1500.50 })
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiProperty({ example: "2026-09-01T00:00:00.000Z" })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({ example: "sup_123" })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiPropertyOptional({ example: "Bulk silk order" })
  @IsOptional()
  @IsString()
  notes?: string;
}
