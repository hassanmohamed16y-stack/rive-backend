import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreatePermissionDto {
  @ApiProperty({ description: "Unique technical permission key", example: "orders.delete" })
  @IsString()
  @IsNotEmpty()
  key!: string;

  @ApiPropertyOptional({ description: "Arabic display name/label for permission", example: "حذف الطلبات" })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ description: "Arabic display name/label for permission", example: "حذف الطلبات" })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  label?: string;
}
