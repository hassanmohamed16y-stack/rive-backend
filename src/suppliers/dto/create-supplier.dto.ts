import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateSupplierDto {
  @ApiProperty({ example: "Egyptian Cotton Co." })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: "Ahmed Hassan" })
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiPropertyOptional({ example: "contact@cotton.eg" })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: "+201000000000" })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: "10 Industrial Zone, Cairo" })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: "Primary fabric supplier" })
  @IsOptional()
  @IsString()
  notes?: string;
}
