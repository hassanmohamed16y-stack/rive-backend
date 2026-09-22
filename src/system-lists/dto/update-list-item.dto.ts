import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, IsString, Min } from "class-validator";

export class UpdateListItemDto {
  @ApiPropertyOptional({
    description: "Unique key within the ListType",
    example: "winter_clothing",
  })
  @IsString()
  @IsOptional()
  key?: string;

  @ApiPropertyOptional({
    description: "Arabic label for the list item",
    example: "ملابس شتوية",
  })
  @IsString()
  @IsOptional()
  labelAr?: string;

  @ApiPropertyOptional({
    description: "English label for the list item",
    example: "Winter Clothing",
  })
  @IsString()
  @IsOptional()
  labelEn?: string;

  @ApiPropertyOptional({
    description: "Sort order index",
    example: 0,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @ApiPropertyOptional({
    description: "Active status flag",
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
