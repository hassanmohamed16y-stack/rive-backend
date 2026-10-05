import { ApiPropertyOptional } from "@nestjs/swagger";
import { OrderStatus } from "@prisma/client";
import { Transform } from "class-transformer";
import { IsEnum, IsOptional } from "class-validator";
import { PaginationDto } from "../../common/dto/pagination.dto";

export class AdminOrdersQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: "Filter orders by status",
    enum: OrderStatus,
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === "" || value === null || value === undefined ? undefined : value,
  )
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}
