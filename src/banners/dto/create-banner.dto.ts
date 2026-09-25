import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsDate,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class CreateBannerDto {
  @ApiProperty({
    description: "Banner title in Arabic",
    example: "تخفيضات الصيف الكبرى",
  })
  @IsString()
  @IsNotEmpty()
  titleAr!: string;

  @ApiPropertyOptional({
    description: "Banner subtitle in Arabic",
    example: "خصم يصل إلى 50% على تشكيلة الصيف",
  })
  @IsString()
  @IsOptional()
  subtitleAr?: string;

  @ApiPropertyOptional({
    description: "Image Cloudinary URL (optional if image file is uploaded)",
    example: "https://res.cloudinary.com/demo/image/upload/v12345/banner.jpg",
  })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({
    description: "Redirect link URL (e.g. link to a category or promo)",
    example: "/categories/summer-collection",
  })
  @IsString()
  @IsOptional()
  linkUrl?: string;

  @ApiProperty({
    description: "Start date and time for promotional banner",
    example: "2025-06-01T00:00:00.000Z",
  })
  @Type(() => Date)
  @IsDate()
  startsAt!: Date;

  @ApiProperty({
    description: "End date and time for promotional banner",
    example: "2025-06-30T23:59:59.000Z",
  })
  @Type(() => Date)
  @IsDate()
  endsAt!: Date;

  @ApiPropertyOptional({
    description: "Scheduled publish date and time for content scheduling",
    example: "2025-06-01T00:00:00.000Z",
  })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  publishAt?: Date;

  @ApiPropertyOptional({
    description: "Scheduled unpublish date and time for content scheduling",
    example: "2025-06-30T23:59:59.000Z",
  })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  unpublishAt?: Date;

  @ApiPropertyOptional({
    description: "Display sort order index (ascending)",
    example: 0,
    default: 0,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @ApiPropertyOptional({
    description: "Whether the banner is active",
    example: true,
    default: true,
  })
  @Transform(({ value }) => {
    if (value === "true" || value === true) return true;
    if (value === "false" || value === false) return false;
    return value;
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
