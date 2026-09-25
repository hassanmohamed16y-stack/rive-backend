import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class UpdateInternalNoteDto {
  @ApiPropertyOptional({ example: "Updated internal note content." })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  content?: string;
}
