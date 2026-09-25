import { ApiProperty } from "@nestjs/swagger";
import { ArrayMinSize, IsArray, IsString } from "class-validator";

export class ReorderProductsDto {
  @ApiProperty({
    example: ["prod_1", "prod_2", "prod_3"],
    description: "Ordered array of product IDs",
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  productIds!: string[];
}
