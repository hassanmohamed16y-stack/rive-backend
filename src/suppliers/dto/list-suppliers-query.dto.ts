import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { PaginationDto } from "../../common/dto/pagination.dto";

export class ListSuppliersQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: "Search query for supplier name, contact, email" })
  @IsOptional()
  @IsString()
  search?: string;
}
