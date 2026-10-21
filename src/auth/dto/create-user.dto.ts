import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateUserDto {
  @ApiProperty({ example: "John Doe" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    example: "user@rive.com",
    description: "Optional when a username is provided.",
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional({
    example: "cashier1",
    description:
      "Sign-in name (3-32 chars: letters, numbers, dot, dash, underscore). Optional when an email is provided.",
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[\p{L}\p{N}._-]+$/u, {
    message:
      "Username may only contain letters, numbers, dot, dash and underscore.",
  })
  username?: string;

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
