import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
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
import { AuthenticatedRequest } from "../common/types/authenticated-request";
import { CreateShippingZoneDto } from "./dto/create-shipping-zone.dto";
import { UpdateShippingZoneDto } from "./dto/update-shipping-zone.dto";
import { ShippingZonesService } from "./shipping-zones.service";

@ApiTags("shipping-zones")
@Controller(["shipping-zones", "api/v1/shipping-zones"])
export class ShippingZonesController {
  constructor(private readonly shippingZonesService: ShippingZonesService) {}

  @Get()
  @ApiOperation({
    summary:
      "Get all active shipping zones for storefront checkout (Public)",
  })
  @ApiResponse({
    status: 200,
    description: "Active shipping zones returned successfully.",
  })
  async findActive() {
    return this.shippingZonesService.findActiveZones();
  }

  @Get("admin")
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles("ADMIN")
  @RequirePermission("lists.manage")
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Get all shipping zones including inactive ones for management (Admin)",
  })
  @ApiResponse({
    status: 200,
    description: "All shipping zones returned successfully.",
  })
  @ApiResponse({ status: 401, description: "Unauthorized." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  async findAllAdmin() {
    return this.shippingZonesService.findAllAdmin();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles("ADMIN")
  @RequirePermission("lists.manage")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a new shipping zone (Admin)" })
  @ApiResponse({
    status: 201,
    description: "Shipping zone created successfully.",
  })
  @ApiResponse({ status: 400, description: "Bad request / Validation error." })
  @ApiResponse({ status: 401, description: "Unauthorized." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiResponse({
    status: 409,
    description: "Shipping zone for this city already exists.",
  })
  async create(
    @Body() dto: CreateShippingZoneDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.shippingZonesService.create(dto, req.user?.id);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles("ADMIN")
  @RequirePermission("lists.manage")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update an existing shipping zone (Admin)" })
  @ApiResponse({
    status: 200,
    description: "Shipping zone updated successfully.",
  })
  @ApiResponse({ status: 401, description: "Unauthorized." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiResponse({ status: 404, description: "Shipping zone not found." })
  @ApiResponse({
    status: 409,
    description: "City label conflict with an existing zone.",
  })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateShippingZoneDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.shippingZonesService.update(id, dto, req.user?.id);
  }

  @Patch(":id/deactivate")
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles("ADMIN")
  @RequirePermission("lists.manage")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Soft-deactivate a shipping zone (isActive = false) (Admin)",
  })
  @ApiResponse({
    status: 200,
    description: "Shipping zone soft-deactivated successfully.",
  })
  @ApiResponse({ status: 401, description: "Unauthorized." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiResponse({ status: 404, description: "Shipping zone not found." })
  async deactivate(
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.shippingZonesService.deactivate(id, req.user?.id);
  }
}
