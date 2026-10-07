import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, Length } from "class-validator";

export class TrackOrderDto {
  @ApiProperty({ example: "RIV-12345678-ABCD", maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  orderNumber!: string;

  @ApiProperty({ example: "+201000000000", maxLength: 30 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 30)
  phone!: string;
}
