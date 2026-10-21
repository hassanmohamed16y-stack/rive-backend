import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class LoginDto {
  @ApiPropertyOptional({
    example: "aisha@example.com",
    description: "Email address. Use `identifier` to sign in with a username.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional({
    example: "cashier1",
    description: "Email or username. Takes precedence over `email`.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(254)
  identifier?: string;

  @ApiProperty({ example: "StrongPass123!" })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
