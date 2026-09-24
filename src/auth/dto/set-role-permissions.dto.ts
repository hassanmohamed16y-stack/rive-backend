import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsOptional, IsString } from "class-validator";

export class SetRolePermissionsDto {
  @ApiPropertyOptional({ description: "List of permission keys or IDs to replace existing role permissions", example: ["orders.view", "orders.refund"] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @ApiPropertyOptional({ description: "List of permission keys", example: ["orders.view", "orders.refund"] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionKeys?: string[];

  @ApiPropertyOptional({ description: "List of permission IDs" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionIds?: string[];
}
