import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class CreateInternalNoteDto {
  @ApiProperty({ example: "Customer requested expedited shipping.", description: "Internal note content" })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiProperty({ example: "Order", description: "Entity type e.g. Order or User" })
  @IsString()
  @IsNotEmpty()
  entityType!: string;

  @ApiProperty({ example: "ord_12345", description: "Entity ID" })
  @IsString()
  @IsNotEmpty()
  entityId!: string;
}
