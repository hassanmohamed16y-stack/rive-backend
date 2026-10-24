import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { getAdminThrottleLimit } from "../common/utils/throttling";
import { timingSafeStringEqual } from "../common/utils/timing-safe-compare";
import { AgentEventsService } from "./agent-events.service";

const STATUSES = new Set(["pending", "sending", "delivered", "failed"]);

/**
 * Worker trigger for the agent outbox. Called every minute by the server cron
 * (private hosting) or by Vercel Cron. Same shared secret as the other
 * internal jobs (INTERNAL_CRON_SECRET), sent either as
 * `x-internal-cron-secret` or as `Authorization: Bearer <secret>` (Vercel Cron).
 */
@ApiTags("internal")
@Controller("api/v1/internal/agent-events")
export class InternalAgentEventsController {
  private readonly logger = new Logger(InternalAgentEventsController.name);

  constructor(private readonly agentEvents: AgentEventsService) {}

  private assertSecret(headerSecret?: string, authorization?: string) {
    const expected = process.env.INTERNAL_CRON_SECRET;
    if (!expected) {
      throw new ForbiddenException("INTERNAL_CRON_SECRET is not configured");
    }
    const bearer = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : undefined;
    if (
      !timingSafeStringEqual(headerSecret, expected) &&
      !timingSafeStringEqual(bearer, expected)
    ) {
      throw new UnauthorizedException("Invalid internal cron secret");
    }
  }

  private async run() {
    const summary = await this.agentEvents.dispatchDue(50);
    const cleaned = await this.agentEvents.cleanup();
    if (summary.claimed > 0 || cleaned > 0) {
      this.logger.log(
        `Agent events: claimed ${summary.claimed}, delivered ${summary.delivered}, retried ${summary.retried}, failed ${summary.failed}, cleaned ${cleaned}`,
      );
    }
    return { ...summary, cleaned };
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("dispatch")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Deliver pending agent events (internal cron only)" })
  @ApiHeader({ name: "x-internal-cron-secret", required: false })
  async dispatch(
    @Headers("x-internal-cron-secret") headerSecret?: string,
    @Headers("authorization") authorization?: string,
  ) {
    this.assertSecret(headerSecret, authorization);
    return this.run();
  }

  /** Vercel Cron only issues GET requests. */
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Get("dispatch")
  @ApiOperation({ summary: "Deliver pending agent events (Vercel Cron)" })
  async dispatchGet(
    @Headers("x-internal-cron-secret") headerSecret?: string,
    @Headers("authorization") authorization?: string,
  ) {
    this.assertSecret(headerSecret, authorization);
    return this.run();
  }
}

@ApiTags("automation")
@Throttle({ default: { limit: getAdminThrottleLimit(), ttl: 60000 } })
@Controller(["api/v1/admin/agent-events"])
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("ADMIN")
@ApiBearerAuth()
export class AdminAgentEventsController {
  constructor(private readonly agentEvents: AgentEventsService) {}

  @RequirePermission("automation.view")
  @Get("stats")
  @ApiOperation({ summary: "Agent connection status and outbox counts" })
  stats() {
    return this.agentEvents.stats();
  }

  @RequirePermission("automation.view")
  @Get()
  @ApiOperation({ summary: "List outbox events (newest first)" })
  list(
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.agentEvents.list({
      status: status && STATUSES.has(status) ? status : undefined,
      page: page ? Number(page) || 1 : 1,
      limit: limit ? Number(limit) || 20 : 20,
    });
  }

  @RequirePermission("automation.edit")
  @Post(":id/resend")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Re-queue a failed event (same event_id)" })
  async resend(@Param("id") id: string) {
    const ok = await this.agentEvents.resend(id);
    if (!ok) throw new NotFoundException("No failed event with this id");
    return { requeued: true, id };
  }
}
