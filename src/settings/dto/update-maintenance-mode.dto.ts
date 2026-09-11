import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class UpdateMaintenanceModeDto {
  @ApiProperty({ description: "Enable or disable global maintenance mode" })
  @IsBoolean()
  maintenanceMode!: boolean;
}
