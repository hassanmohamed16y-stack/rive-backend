import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AuthenticatedRequest } from "../common/types/authenticated-request";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { ListSuppliersQueryDto } from "./dto/list-suppliers-query.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";
import { SuppliersService } from "./suppliers.service";

@ApiTags("admin suppliers")
@Controller(["api/admin/suppliers", "api/v1/admin/suppliers"])
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("ADMIN")
@RequirePermission("suppliers.manage")
@ApiBearerAuth()
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  @ApiOperation({ summary: "Create a supplier (Admin)" })
  @ApiResponse({ status: 201, description: "Supplier created." })
  async create(@Body() dto: CreateSupplierDto, @Req() req: AuthenticatedRequest) {
    return this.suppliersService.create(dto, req.user!.id);
  }

  @Get()
  @ApiOperation({ summary: "List suppliers (Admin)" })
  @ApiResponse({ status: 200, description: "Paginated list of suppliers." })
  async findAll(@Query() query: ListSuppliersQueryDto) {
    return this.suppliersService.findAll(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get supplier by ID (Admin)" })
  @ApiResponse({ status: 200, description: "Supplier found." })
  @ApiResponse({ status: 404, description: "Supplier not found." })
  async findOne(@Param("id") id: string) {
    return this.suppliersService.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update supplier (Admin)" })
  @ApiResponse({ status: 200, description: "Supplier updated." })
  @ApiResponse({ status: 404, description: "Supplier not found." })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateSupplierDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.suppliersService.update(id, dto, req.user!.id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Soft delete supplier (Admin)" })
  @ApiResponse({ status: 200, description: "Supplier soft deleted." })
  @ApiResponse({ status: 404, description: "Supplier not found." })
  async remove(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return this.suppliersService.softDelete(id, req.user!.id);
  }
}
