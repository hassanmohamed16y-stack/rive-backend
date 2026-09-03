import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBooleanString, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ListCategoriesQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by featured flag', type: Boolean })
  @IsOptional()
  @IsBooleanString()
  isFeatured?: string;
}
