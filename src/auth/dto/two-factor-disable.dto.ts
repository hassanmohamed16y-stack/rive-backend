import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class TwoFactorDisableDto {
  @ApiProperty({
    description: "Current account password",
    example: "Password123!",
  })
  @IsString()
  @IsNotEmpty()
  password!: string;

  @ApiProperty({
    description: "6-digit TOTP code or 10-character recovery code",
    example: "123456",
  })
  @IsString()
  @IsNotEmpty()
  code!: string;
}
