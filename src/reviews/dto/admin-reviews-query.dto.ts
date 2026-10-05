import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean, IsOptional } from "class-validator";
import { PaginationDto } from "../../common/dto/pagination.dto";

export class AdminReviewsQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: "Filter reviews by approval status",
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === "" || value === null || value === undefined) return undefined;
    if (value === "true" || value === true) return true;
    if (value === "false" || value === false) return false;
    return value;
  })
  @IsBoolean()
  isApproved?: boolean;
}
