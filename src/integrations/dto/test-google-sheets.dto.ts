import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsOptional, IsString } from "class-validator";

export class TestGoogleSheetsDto {
  @ApiProperty({
    description: "Optional custom row values to append to the test sheet",
    required: false,
    type: [String],
    example: ["Test Entry", "RIVÉ Backend", "SUCCESS"],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  rowData?: string[];
}
