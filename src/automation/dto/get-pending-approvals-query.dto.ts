import { ApiPropertyOptional } from "@nestjs/swagger";
import { PendingApprovalStatus } from "@prisma/client";
import { IsEnum, IsOptional } from "class-validator";

export class GetPendingApprovalsQueryDto {
  @ApiPropertyOptional({
    enum: PendingApprovalStatus,
    description: "Filter pending approvals by status",
  })
  @IsOptional()
  @IsEnum(PendingApprovalStatus)
  status?: PendingApprovalStatus;
}
