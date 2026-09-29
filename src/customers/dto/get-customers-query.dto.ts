import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { PaginationDto } from "../../common/dto/pagination.dto";

export class GetCustomersQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: "Search by customer name or email" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: "Filter by customer tier (NEW, REGULAR, VIP)",
    enum: ["NEW", "REGULAR", "VIP"],
  })
  @IsOptional()
  @IsString()
  tier?: string;
}
