import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class ValidateReferralDto {
  @ApiProperty({ example: "REF-AISH12" })
  @IsString()
  @IsNotEmpty()
  code!: string;
}
