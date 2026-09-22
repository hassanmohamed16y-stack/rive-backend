import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean, IsOptional } from "class-validator";

export class ListItemsQueryDto {
  @ApiPropertyOptional({
    description:
      "Whether to include inactive items. Defaults to false (returns active items only).",
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  includeInactive?: boolean;
}
