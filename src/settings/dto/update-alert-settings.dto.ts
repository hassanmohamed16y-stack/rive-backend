import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsEmail, IsInt, IsOptional, Min } from "class-validator";

export class UpdateAlertSettingsDto {
  @ApiPropertyOptional({ example: 5, description: "Threshold quantity for low stock alerts" })
  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  @ApiPropertyOptional({ example: ["alerts@rive.com"], description: "List of email addresses to receive alerts" })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  alertEmails?: string[];

  @ApiPropertyOptional({ example: true, description: "Toggle new order email alerts" })
  @IsOptional()
  @IsBoolean()
  newOrderAlertsEnabled?: boolean;

  @ApiPropertyOptional({ example: true, description: "Toggle low stock email alerts" })
  @IsOptional()
  @IsBoolean()
  lowStockAlertsEnabled?: boolean;

  @ApiPropertyOptional({ example: true, description: "Toggle failed payment email alerts" })
  @IsOptional()
  @IsBoolean()
  failedPaymentAlertsEnabled?: boolean;
}
