import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ListProductsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(256)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  isFeatured?: string;
}
