import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional } from "class-validator";

export class TestAlertDto {
  @ApiPropertyOptional({ example: "admin@example.com", description: "Target email for the test alert" })
  @IsOptional()
  @IsEmail()
  email?: string;
}
