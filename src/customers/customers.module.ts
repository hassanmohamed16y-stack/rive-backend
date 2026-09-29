import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AdminCustomersController } from "./admin-customers.controller";
import { CustomersService } from "./customers.service";

@Module({
  imports: [PrismaModule],
  controllers: [AdminCustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
