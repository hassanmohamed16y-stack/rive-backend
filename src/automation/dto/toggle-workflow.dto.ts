import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";

export class ToggleWorkflowDto {
  @ApiPropertyOptional({
    description: "Optional explicit active status. If omitted, current status will be toggled.",
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
