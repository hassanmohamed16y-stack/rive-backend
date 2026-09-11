import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, Matches } from "class-validator";

export class TestWhatsAppDto {
  @ApiProperty({
    description: "Target recipient phone number in international E.164 format (e.g., +201234567890)",
    example: "+201234567890",
  })
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: "recipientPhoneNumber must be a valid phone number in international format",
  })
  recipientPhoneNumber!: string;

  @ApiProperty({
    description: "Optional custom message body for the test message",
    required: false,
    example: "Test notification from RIVÉ backend",
  })
  @IsOptional()
  @IsString()
  message?: string;
}
