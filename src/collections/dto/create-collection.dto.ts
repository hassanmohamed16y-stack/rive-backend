import { ApiProperty } from "@nestjs/swagger";
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from "class-validator";

export class CreateCollectionDto {
  @ApiProperty({ example: "Summer Luxury Collection" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: "summer-luxury-collection" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  slug!: string;

  @ApiProperty({ example: "Exclusive luxury items for summer", required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: "https://example.com/collection.jpg", required: false })
  @IsUrl(
    { require_protocol: true, protocols: ["http", "https"] },
    { message: "imageUrl must be a valid HTTP or HTTPS URL" },
  )
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;
}
