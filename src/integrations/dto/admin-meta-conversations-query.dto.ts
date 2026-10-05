import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsOptional, IsString, MaxLength } from "class-validator";
import { PaginationDto } from "../../common/dto/pagination.dto";

export class AdminMetaConversationsQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: "Filter by platform (e.g. facebook, instagram)",
    maxLength: 100,
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === "" || value === null || value === undefined
      ? undefined
      : typeof value === "string"
        ? value.trim()
        : value,
  )
  @IsString()
  @MaxLength(100)
  platform?: string;

  @ApiPropertyOptional({
    description: "Filter by conversation status",
    maxLength: 100,
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === "" || value === null || value === undefined
      ? undefined
      : typeof value === "string"
        ? value.trim()
        : value,
  )
  @IsString()
  @MaxLength(100)
  status?: string;

  @ApiPropertyOptional({
    description: "Search term across name/email/last message",
    maxLength: 200,
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === "" || value === null || value === undefined
      ? undefined
      : typeof value === "string"
        ? value.trim()
        : value,
  )
  @IsString()
  @MaxLength(200)
  search?: string;
}
