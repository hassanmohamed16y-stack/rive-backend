import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateReviewDto {
  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({ example: "Exquisite silk quality and perfect fit!" })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional({ example: "Aisha R." })
  @IsOptional()
  @IsString()
  authorName?: string;
}
