import { ApiProperty } from "@nestjs/swagger";
import { WorkflowTrustLevel } from "@prisma/client";
import { IsEnum, IsNotEmpty } from "class-validator";

export class UpdateTrustLevelDto {
  @ApiProperty({
    enum: WorkflowTrustLevel,
    description: "Trust level for workflow execution",
    example: WorkflowTrustLevel.requires_approval,
  })
  @IsNotEmpty()
  @IsEnum(WorkflowTrustLevel)
  trustLevel!: WorkflowTrustLevel;
}
