import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateRoleDto {
  @ApiProperty({ description: "Technical unique role name", example: "inventory_manager" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: "Arabic display label for role", example: "مدير المخزون" })
  @IsString()
  @IsNotEmpty()
  label!: string;

  @ApiPropertyOptional({ description: "Optional list of permission keys", example: ["products.view", "products.edit"] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionKeys?: string[];

  @ApiPropertyOptional({ description: "Optional list of permission IDs" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionIds?: string[];
}
