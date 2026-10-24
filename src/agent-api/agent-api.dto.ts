import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

/** Statuses the agent may set on its own. Money moves are not in this list. */
export const AGENT_ALLOWED_STATUSES = [
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;

/** Need the owner's approval (contract §6): never reachable by the agent alone. */
export const OWNER_ONLY_STATUSES = ["PAID", "REFUNDED"] as const;

export class AgentUpdateStatusDto {
  @ApiProperty({ enum: [...AGENT_ALLOWED_STATUSES, ...OWNER_ONLY_STATUSES] })
  @IsString()
  @IsIn([...AGENT_ALLOWED_STATUSES, ...OWNER_ONLY_STATUSES])
  to!: string;

  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class AgentAddNoteDto {
  @ApiProperty({ minLength: 1, maxLength: 2000 })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;
}
