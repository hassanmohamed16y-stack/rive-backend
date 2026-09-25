import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AdminCartSessionsController } from "./admin-cart-sessions.controller";
import { CartSessionsController } from "./cart-sessions.controller";
import { CartSessionsService } from "./cart-sessions.service";

@Module({
  imports: [PrismaModule],
  controllers: [CartSessionsController, AdminCartSessionsController],
  providers: [CartSessionsService],
  exports: [CartSessionsService],
})
export class CartSessionsModule {}
