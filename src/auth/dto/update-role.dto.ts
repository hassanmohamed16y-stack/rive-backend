import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class UpdateRoleDto {
  @ApiPropertyOptional({ description: "Updated technical role name", example: "inventory_manager_v2" })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ description: "Updated Arabic display label", example: "مدير المخزون الرئيسي" })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  label?: string;
}
