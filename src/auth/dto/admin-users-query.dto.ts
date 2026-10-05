import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsOptional, IsString, MaxLength } from "class-validator";
import { PaginationDto } from "../../common/dto/pagination.dto";

export class AdminUsersQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: "Search string for name/email",
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

  @ApiPropertyOptional({
    description: "Filter by user role",
    maxLength: 50,
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
  @MaxLength(50)
  role?: string;
}
