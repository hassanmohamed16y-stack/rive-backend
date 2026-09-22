import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString } from "class-validator";

export class UpdateUserDto {
  @ApiPropertyOptional({ example: "John Doe" })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: "role_id_123" })
  @IsString()
  @IsOptional()
  roleId?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
