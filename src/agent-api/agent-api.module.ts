import { Module } from "@nestjs/common";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { OrdersModule } from "../orders/orders.module";
import { AgentApiController } from "./agent-api.controller";
import { AgentApiService } from "./agent-api.service";
import { AgentServiceTokenGuard } from "./agent-service-token.guard";

@Module({
  imports: [OrdersModule, AuditLogModule],
  controllers: [AgentApiController],
  providers: [AgentApiService, AgentServiceTokenGuard],
  exports: [AgentApiService],
})
export class AgentApiModule {}
