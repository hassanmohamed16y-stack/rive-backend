import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";
import { PaginationDto } from "../../common/dto/pagination.dto";

export class AbandonedCartsQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: "Inactivity duration in minutes",
    default: 30,
    minimum: 1,
    maximum: 43200,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(43200)
  inactivityMinutes: number = 30;
}
