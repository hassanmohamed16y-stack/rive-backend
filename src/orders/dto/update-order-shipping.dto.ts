import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class UpdateOrderShippingDto {
  @ApiPropertyOptional({ example: "DHL Express", description: "Shipping carrier name" })
  @IsOptional()
  @IsString()
  carrier?: string;

  @ApiPropertyOptional({ example: "1234567890", description: "Package tracking number" })
  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @ApiPropertyOptional({ example: "https://dhl.com/track/1234567890", description: "Tracking URL" })
  @IsOptional()
  @IsString()
  trackingUrl?: string;

  @ApiPropertyOptional({ example: "123 Nile St, Cairo, Egypt", description: "Shipping delivery address" })
  @IsOptional()
  @IsString()
  shippingAddress?: string;
}
