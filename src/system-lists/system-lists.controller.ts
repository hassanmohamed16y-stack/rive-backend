import {
  Body,
  Controller,
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
import { CreateListItemDto } from "./dto/create-list-item.dto";
import { ListItemsQueryDto } from "./dto/list-items-query.dto";
import { UpdateListItemDto } from "./dto/update-list-item.dto";
import { SystemListsService } from "./system-lists.service";

@ApiTags("system-lists")
@Controller(["system-lists", "api/v1/system-lists"])
export class SystemListsController {
  constructor(private readonly systemListsService: SystemListsService) {}

  @Get("types")
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles("ADMIN")
  @RequirePermission("lists.manage")
  @ApiBearerAuth()
  @ApiOperation({ summary: "List all defined ListTypes (Admin)" })
  @ApiResponse({
    status: 200,
    description: "List of all ListTypes returned successfully.",
  })
  @ApiResponse({ status: 401, description: "Unauthorized." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  async findAllTypes() {
    return this.systemListsService.findAllTypes();
  }

  @Get(":listTypeKey/items")
  @ApiOperation({
    summary:
      "Get all active ListItems for a given list type (Public). Use includeInactive=true for admin views.",
  })
  @ApiResponse({
    status: 200,
    description: "ListItems returned successfully.",
  })
  @ApiResponse({ status: 404, description: "ListType not found." })
  async findItems(
    @Param("listTypeKey") listTypeKey: string,
    @Query() query: ListItemsQueryDto,
  ) {
    return this.systemListsService.findItemsByTypeKey(
      listTypeKey,
      query.includeInactive,
    );
  }

  @Post(":listTypeKey/items")
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles("ADMIN")
  @RequirePermission("lists.manage")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Add a new ListItem to a list type (Admin)" })
  @ApiResponse({ status: 201, description: "ListItem created successfully." })
  @ApiResponse({ status: 400, description: "Bad request / Validation error." })
  @ApiResponse({ status: 401, description: "Unauthorized." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiResponse({ status: 404, description: "ListType not found." })
  @ApiResponse({
    status: 409,
    description: "ListItem with this key already exists in this list type.",
  })
  async createItem(
    @Param("listTypeKey") listTypeKey: string,
    @Body() dto: CreateListItemDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.systemListsService.createItem(
      listTypeKey,
      dto,
      req.user?.id,
    );
  }

  @Patch("items/:id")
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles("ADMIN")
  @RequirePermission("lists.manage")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update an existing ListItem (Admin)" })
  @ApiResponse({ status: 200, description: "ListItem updated successfully." })
  @ApiResponse({ status: 401, description: "Unauthorized." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiResponse({ status: 404, description: "ListItem not found." })
  @ApiResponse({
    status: 409,
    description: "ListItem key conflict within the list type.",
  })
  async updateItem(
    @Param("id") id: string,
    @Body() dto: UpdateListItemDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.systemListsService.updateItem(id, dto, req.user?.id);
  }

  @Patch("items/:id/deactivate")
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles("ADMIN")
  @RequirePermission("lists.manage")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Soft-deactivate a ListItem (isActive = false) (Admin)",
  })
  @ApiResponse({ status: 200, description: "ListItem soft-deactivated." })
  @ApiResponse({ status: 401, description: "Unauthorized." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiResponse({ status: 404, description: "ListItem not found." })
  async deactivateItem(
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.systemListsService.deactivateItem(id, req.user?.id);
  }
}
