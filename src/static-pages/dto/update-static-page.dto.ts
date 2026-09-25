import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString } from "class-validator";

export class UpdateStaticPageDto {
  @ApiPropertyOptional({ description: "Page title in Arabic" })
  @IsOptional()
  @IsString()
  titleAr?: string;

  @ApiPropertyOptional({ description: "Page title in English" })
  @IsOptional()
  @IsString()
  titleEn?: string;

  @ApiPropertyOptional({ description: "Page content in Arabic" })
  @IsOptional()
  @IsString()
  contentAr?: string;

  @ApiPropertyOptional({ description: "Page content in English" })
  @IsOptional()
  @IsString()
  contentEn?: string;

  @ApiPropertyOptional({ description: "SEO Title" })
  @IsOptional()
  @IsString()
  seoTitle?: string;

  @ApiPropertyOptional({ description: "SEO Description" })
  @IsOptional()
  @IsString()
  seoDescription?: string;

  @ApiPropertyOptional({ description: "Whether the static page is published" })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
