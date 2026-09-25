import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

export class UpdateSiteSettingsDto {
  @ApiPropertyOptional({ example: "RIVÉ Store" })
  @IsOptional()
  @IsString()
  storeName?: string;

  @ApiPropertyOptional({ example: "https://example.com/logo.png" })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ example: "+201000000000" })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: "contact@rive.com" })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: "Cairo, Egypt" })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: "https://facebook.com/rive" })
  @IsOptional()
  @IsString()
  facebookUrl?: string;

  @ApiPropertyOptional({ example: "https://instagram.com/rive" })
  @IsOptional()
  @IsString()
  instagramUrl?: string;

  @ApiPropertyOptional({ example: "+201000000000" })
  @IsOptional()
  @IsString()
  whatsappNumber?: string;

  @ApiPropertyOptional({ example: "https://tiktok.com/@rive" })
  @IsOptional()
  @IsString()
  tiktokUrl?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isMaintenanceMode?: boolean;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minimumOrderAmount?: number;

  @ApiPropertyOptional({
    example: { sunday: { open: "09:00", close: "22:00" } },
  })
  @IsOptional()
  @IsObject()
  businessHours?: Record<string, any>;
}
