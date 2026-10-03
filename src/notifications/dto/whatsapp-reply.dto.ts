import { ApiProperty } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export class SendWhatsAppReplyDto {
  @ApiProperty({ description: "Message text to send (1 to 1000 characters)" })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: string }) => (typeof value === "string" ? value.trim() : value))
  @MinLength(1)
  @MaxLength(1000)
  text!: string;
}

export class WhatsAppPaginationQueryDto {
  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
