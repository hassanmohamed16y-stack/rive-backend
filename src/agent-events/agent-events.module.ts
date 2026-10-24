import { Global, Module } from "@nestjs/common";
import {
  AdminAgentEventsController,
  InternalAgentEventsController,
} from "./agent-events.controller";
import { AgentEventsService } from "./agent-events.service";

/** Global so orders, payments and auth can emit events without import cycles. */
@Global()
@Module({
  controllers: [InternalAgentEventsController, AdminAgentEventsController],
  providers: [AgentEventsService],
  exports: [AgentEventsService],
})
export class AgentEventsModule {}
