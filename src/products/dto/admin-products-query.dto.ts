import { ApiPropertyOptional } from "@nestjs/swagger";
import { ProductStatus } from "@prisma/client";
import { Transform } from "class-transformer";
import { IsEnum, IsOptional } from "class-validator";
import { PaginationDto } from "../../common/dto/pagination.dto";

export class AdminProductsQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: "Filter products by status",
    enum: ProductStatus,
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === "" || value === null || value === undefined ? undefined : value,
  )
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}
