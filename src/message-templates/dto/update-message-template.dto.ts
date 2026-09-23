import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString } from "class-validator";

export class UpdateMessageTemplateDto {
  @ApiPropertyOptional({ description: "Subject line (primarily for email templates)" })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ description: "Arabic body template with placeholders" })
  @IsOptional()
  @IsString()
  bodyAr?: string;

  @ApiPropertyOptional({ description: "English body template with placeholders" })
  @IsOptional()
  @IsString()
  bodyEn?: string;

  @ApiPropertyOptional({ description: "Whether the message template is active" })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
