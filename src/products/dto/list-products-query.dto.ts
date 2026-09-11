import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsBooleanString,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { PaginationDto } from "../../common/dto/pagination.dto";

export class ListProductsQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: "Category slug to filter by",
    maxLength: 160,
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  category?: string;

  @ApiPropertyOptional({
    description: "Collection slug to filter by",
    maxLength: 160,
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  collection?: string;

  @ApiPropertyOptional({
    description: "Maximum price filter (e.g. 200 for Under 200 EGP)",
  })
  @IsOptional()
  @IsNumberString()
  maxPrice?: string;

  @ApiPropertyOptional({
    description: "Minimum price filter",
  })
  @IsOptional()
  @IsNumberString()
  minPrice?: string;

  @ApiPropertyOptional({
    description: "Filter by discounted items (offers)",
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => value)
  @IsBooleanString()
  hasDiscount?: string;

  @ApiPropertyOptional({
    description: "Filter by featured flag",
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => value)
  @IsBooleanString()
  isFeatured?: string;

  @ApiPropertyOptional({
    description: "Free-text search across name/description",
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
