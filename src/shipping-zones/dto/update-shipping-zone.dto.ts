import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class UpdateShippingZoneDto {
  @ApiPropertyOptional({
    description: "City label for the shipping zone",
    example: "القاهرة الكبرى",
  })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  cityLabel?: string;

  @ApiPropertyOptional({
    description: "Shipping fee price in EGP",
    example: 60.0,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @ApiPropertyOptional({
    description: "Estimated delivery time in days",
    example: 3,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  estimatedDays?: number;

  @ApiPropertyOptional({
    description: "Whether the shipping zone is active for selection",
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: "Sort order index",
    example: 1,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}
