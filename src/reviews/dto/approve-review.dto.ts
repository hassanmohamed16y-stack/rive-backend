import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class ApproveReviewDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  isApproved!: boolean;
}
