import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class CreateDeletionRequestDto {
  @ApiPropertyOptional({ example: "Closing account permanently" })
  @IsOptional()
  @IsString()
  reason?: string;
}
