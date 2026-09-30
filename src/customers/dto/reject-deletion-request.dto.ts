import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class RejectDeletionRequestDto {
  @ApiPropertyOptional({ example: "Dispute pending" })
  @IsOptional()
  @IsString()
  adminNotes?: string;
}
