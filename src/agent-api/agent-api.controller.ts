import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { AgentAddNoteDto, AgentUpdateStatusDto } from "./agent-api.dto";
import { AgentApiService } from "./agent-api.service";
import { AgentServiceTokenGuard } from "./agent-service-token.guard";

/**
 * The AI agent's door into the store (EVENTS_CONTRACT.md §6).
 * Read endpoints + safe writes only. Anything that moves money returns 403.
 */
@ApiTags("agent")
@ApiBearerAuth()
@Throttle({ default: { limit: 120, ttl: 60000 } })
@UseGuards(AgentServiceTokenGuard)
@Controller("api/v1/agent")
export class AgentApiController {
  constructor(private readonly agentApi: AgentApiService) {}

  @Get("health")
  @ApiOperation({ summary: "Agent token check" })
  health() {
    return {
      ok: true,
      events_enabled: process.env.AGENT_EVENTS_ENABLED === "true",
      test_mode: process.env.AGENT_EVENTS_TEST === "true",
    };
  }

  @Get("orders")
  @ApiOperation({ summary: "List orders changed since a date" })
  listOrders(
    @Query("status") status?: string,
    @Query("since") since?: string,
    @Query("limit") limit?: string,
  ) {
    return this.agentApi.listOrders({
      status,
      since,
      limit: limit ? Number(limit) || 50 : 50,
    });
  }

  @Get("orders/:id")
  @ApiOperation({ summary: "One order (id or order number)" })
  getOrder(@Param("id") id: string) {
    return this.agentApi.getOrder(id);
  }

  @Post("orders/:id/status")
  @HttpCode(HttpStatus.OK)
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiOperation({ summary: "Safe status change (no money moves)" })
  updateStatus(
    @Param("id") id: string,
    @Body() dto: AgentUpdateStatusDto,
    @Headers("idempotency-key") key?: string,
  ) {
    return this.agentApi.idempotent(key, `status:${id}:${dto.to}`, () =>
      this.agentApi.updateStatus(id, dto.to, dto.reason),
    );
  }

  @Post("orders/:id/notes")
  @HttpCode(HttpStatus.OK)
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiOperation({ summary: "Add an internal note visible in the admin panel" })
  addNote(
    @Param("id") id: string,
    @Body() dto: AgentAddNoteDto,
    @Headers("idempotency-key") key?: string,
  ) {
    return this.agentApi.idempotent(key, `note:${id}`, () =>
      this.agentApi.addNote(id, dto.content),
    );
  }

  @Get("payments")
  @ApiOperation({ summary: "Card payments changed since a date (reconciliation)" })
  listPayments(@Query("since") since?: string) {
    return this.agentApi.listPayments(since);
  }
}
