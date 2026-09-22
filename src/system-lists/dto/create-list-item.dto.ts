import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from "class-validator";

export class CreateListItemDto {
  @ApiProperty({
    description: "Unique key within the ListType",
    example: "winter_clothing",
  })
  @IsString()
  @IsNotEmpty()
  key!: string;

  @ApiProperty({
    description: "Arabic label for the list item",
    example: "ملابس شتوية",
  })
  @IsString()
  @IsNotEmpty()
  labelAr!: string;

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
    default: 0,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}
