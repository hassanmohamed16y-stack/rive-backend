import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";

export class CreateUserDto {
  @ApiProperty({ example: "John Doe" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: "user@rive.com" })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: "SecurePass123!" })
  @IsString()
  @MinLength(8)
  @IsNotEmpty()
  password!: string;

  @ApiPropertyOptional({ example: "role_id_123" })
  @IsString()
  @IsOptional()
  roleId?: string;
}
