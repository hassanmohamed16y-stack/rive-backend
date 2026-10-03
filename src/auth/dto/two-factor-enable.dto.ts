import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class TwoFactorEnableDto {
  @ApiProperty({
    description: "6-digit TOTP code from authenticator app",
    example: "123456",
  })
  @IsString()
  @IsNotEmpty()
  code!: string;
}
