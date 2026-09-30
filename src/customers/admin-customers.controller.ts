import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { PaginationDto } from "../common/dto/pagination.dto";
import { CustomersService } from "./customers.service";
import { GetCustomersQueryDto } from "./dto/get-customers-query.dto";

@ApiTags("admin customers")
@Controller(["api/admin/customers", "api/v1/admin/customers"])
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("ADMIN")
@ApiBearerAuth()
export class AdminCustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @RequirePermission("customers.view")
  @ApiOperation({ summary: "Get paginated list of customers (Admin)" })
  @ApiResponse({ status: 200, description: "Paginated customers list returned." })
  @ApiResponse({ status: 403, description: "Insufficient permissions." })
  async findAll(@Query() query: GetCustomersQueryDto) {
    return this.customersService.findAll(query);
  }

  @Get("email/:email")
  @RequirePermission("customers.view")
  @ApiOperation({ summary: "Get customer profile by email (Admin)" })
  @ApiResponse({ status: 200, description: "Customer profile returned." })
  @ApiResponse({ status: 404, description: "Customer not found." })
  async findByEmail(@Param("email") email: string) {
    return this.customersService.findByEmail(email);
  }

  @Get(":id/orders")
  @RequirePermission("customers.view")
  @ApiOperation({ summary: "Get customer orders (Admin)" })
  @ApiResponse({ status: 200, description: "Paginated customer orders returned." })
  @ApiResponse({ status: 404, description: "Customer not found." })
  async findCustomerOrders(
    @Param("id") id: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.customersService.findCustomerOrders(id, pagination);
  }

  @Get(":id/activity")
  @RequirePermission("customers.view")
  @ApiOperation({ summary: "Get customer activity timeline (Admin)" })
  @ApiResponse({ status: 200, description: "Paginated customer activity timeline returned." })
  @ApiResponse({ status: 404, description: "Customer not found." })
  async findCustomerActivity(
    @Param("id") id: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.customersService.getCustomerActivity(id, pagination);
  }

  @Get(":id")
  @RequirePermission("customers.view")
  @ApiOperation({ summary: "Get customer profile by ID (Admin)" })
  @ApiResponse({ status: 200, description: "Customer profile returned." })
  @ApiResponse({ status: 404, description: "Customer not found." })
  async findOne(@Param("id") id: string) {
    return this.customersService.findOne(id);
  }
}
