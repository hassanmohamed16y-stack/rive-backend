import { Controller, Get, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { PermissionsGuard } from "./permissions.guard";
import { RequirePermission } from "./permissions.decorator";
import { UsersService } from "./users.service";

@ApiTags("roles")
@Controller(["api/v1/roles", "roles"])
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission("users.manage")
@ApiBearerAuth()
export class RolesController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: "List all roles with their permissions" })
  @ApiResponse({ status: 200, description: "List of roles returned." })
  async findAll() {
    return this.usersService.findAllRoles();
  }
}
