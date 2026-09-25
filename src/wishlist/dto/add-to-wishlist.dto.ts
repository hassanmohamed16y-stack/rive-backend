import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class AddToWishlistDto {
  @ApiProperty({ example: "prod_12345" })
  @IsString()
  @IsNotEmpty()
  productId!: string;
}
