import {
  Body,
  Controller,
  Get,
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
import { JwtAuthGuard } from "./jwt-auth.guard";
import { FullAdminGuard } from "./full-admin.guard";
import { PermissionsService } from "./permissions.service";
import { CreatePermissionDto } from "./dto/create-permission.dto";
import { AuthenticatedRequest } from "../common/types/authenticated-request";

@ApiTags("permissions")
@Controller(["api/v1/permissions", "permissions"])
@UseGuards(JwtAuthGuard, FullAdminGuard)
@ApiBearerAuth()
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @ApiOperation({ summary: "List all permissions grouped by department (full_admin only)" })
  @ApiResponse({ status: 200, description: "Grouped permissions returned." })
  async findAllGrouped() {
    return this.permissionsService.findAllPermissionsGrouped();
  }

  @Post()
  @ApiOperation({ summary: "Create a new permission (full_admin only)" })
  @ApiResponse({ status: 201, description: "Permission created successfully." })
  @ApiResponse({ status: 409, description: "Permission key already exists." })
  async create(
    @Body() dto: CreatePermissionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.permissionsService.createPermission(dto, req.user!.id);
  }
}
