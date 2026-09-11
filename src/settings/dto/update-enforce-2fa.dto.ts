import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class UpdateEnforce2FaDto {
  @ApiProperty({ description: "Enforce 2FA globally for all admin accounts" })
  @IsBoolean()
  enforce2FAGlobally!: boolean;
}
