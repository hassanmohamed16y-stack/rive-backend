import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString } from "class-validator";

export class UpdateProductImageDto {
  @ApiPropertyOptional({ example: "Front view of silk dress", description: "Image alt text" })
  @IsOptional()
  @IsString()
  altText?: string;

  @ApiPropertyOptional({ example: true, description: "Whether this image is the primary thumbnail" })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
