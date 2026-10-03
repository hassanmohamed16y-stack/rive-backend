import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class TwoFactorVerifyDto {
  @ApiProperty({
    description: "Two-factor token issued during login",
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  })
  @IsString()
  @IsNotEmpty()
  twoFactorToken!: string;

  @ApiProperty({
    description: "6-digit TOTP code or 10-character recovery code",
    example: "123456",
  })
  @IsString()
  @IsNotEmpty()
  code!: string;
}
