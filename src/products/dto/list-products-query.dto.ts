import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBooleanString, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ListProductsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Category slug to filter by', maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  category?: string;

  @ApiPropertyOptional({ description: 'Filter by featured flag', type: Boolean })
  @IsOptional()
  @Transform(({ value }) => value)
  @IsBooleanString()
  isFeatured?: string;

  @ApiPropertyOptional({ description: 'Free-text search across name/description', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
