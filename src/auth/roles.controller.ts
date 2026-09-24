import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
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
import { RolesService } from "./roles.service";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { SetRolePermissionsDto } from "./dto/set-role-permissions.dto";
import { AuthenticatedRequest } from "../common/types/authenticated-request";

@ApiTags("roles")
@Controller(["api/v1/roles", "roles"])
@UseGuards(JwtAuthGuard, FullAdminGuard)
@ApiBearerAuth()
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @ApiOperation({ summary: "List all roles with their permissions (full_admin only)" })
  @ApiResponse({ status: 200, description: "List of roles returned." })
  async findAll() {
    return this.rolesService.findAllRoles();
  }

  @Post()
  @ApiOperation({ summary: "Create a new role (full_admin only)" })
  @ApiResponse({ status: 201, description: "Role created successfully." })
  @ApiResponse({ status: 409, description: "Role name already exists." })
  async create(
    @Body() dto: CreateRoleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.rolesService.createRole(dto, req.user!.id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update role name/label (full_admin only)" })
  @ApiResponse({ status: 200, description: "Role updated successfully." })
  @ApiResponse({ status: 404, description: "Role not found." })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateRoleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.rolesService.updateRole(id, dto, req.user!.id);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a role (full_admin only)" })
  @ApiResponse({ status: 200, description: "Role deleted successfully." })
  @ApiResponse({ status: 400, description: "Role has assigned users or is full_admin." })
  @ApiResponse({ status: 404, description: "Role not found." })
  async delete(
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.rolesService.deleteRole(id, req.user!.id);
  }

  @Put(":id/permissions")
  @ApiOperation({ summary: "Set permissions for a role (replace existing) (full_admin only)" })
  @ApiResponse({ status: 200, description: "Role permissions updated successfully." })
  @ApiResponse({ status: 404, description: "Role not found." })
  async setPermissions(
    @Param("id") id: string,
    @Body() dto: SetRolePermissionsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.rolesService.setRolePermissions(id, dto, req.user!.id);
  }
}
