import { ApiPropertyOptional } from "@nestjs/swagger";
import { DeletionRequestStatus } from "@prisma/client";
import { IsEnum, IsOptional } from "class-validator";
import { PaginationDto } from "../../common/dto/pagination.dto";

export class ListDeletionRequestsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: DeletionRequestStatus })
  @IsOptional()
  @IsEnum(DeletionRequestStatus)
  status?: DeletionRequestStatus;
}
