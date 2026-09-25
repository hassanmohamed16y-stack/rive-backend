import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsOptional, IsString } from "class-validator";

export class SyncCartDto {
  @ApiPropertyOptional({ example: "cm3r5xj4g0000s7d7f1q2n9v" })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiProperty({ example: [{ variantId: "var_1", quantity: 2, price: 150 }] })
  @IsArray()
  items!: any[];
}
