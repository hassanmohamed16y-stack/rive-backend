import { IsIn, IsOptional } from 'class-validator';

export class ListCategoriesQueryDto {
  @IsOptional()
  @IsIn(['true', 'false'])
  isFeatured?: string;
}
