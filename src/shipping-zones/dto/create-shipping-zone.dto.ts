import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateShippingZoneDto {
  @ApiProperty({
    description: "City label for the shipping zone (e.g. القاهرة, الإسكندرية, غير محدد)",
    example: "القاهرة",
  })
  @IsString()
  @IsNotEmpty()
  cityLabel!: string;

  @ApiProperty({
    description: "Shipping fee price in EGP",
    example: 50.0,
  })
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiPropertyOptional({
    description: "Estimated delivery time in days",
    example: 2,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  estimatedDays?: number;

  @ApiPropertyOptional({
    description: "Whether the shipping zone is active for selection",
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

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
