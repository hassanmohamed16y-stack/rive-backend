import { getAdminThrottleLimit } from "../common/utils/throttling";
import { Throttle } from "@nestjs/throttler";
import {
  Body,
  Controller,
  Get,
  Param,
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
import { JwtAuthGuard } from "./jwt-auth.guard";
import { RequirePermission } from "./permissions.decorator";
import { PermissionsGuard } from "./permissions.guard";
import { Roles } from "./roles.decorator";
import { RolesGuard } from "./roles.guard";
import { AuthService } from "./auth.service";
import { CreateAdminDto } from "./dto/create-admin.dto";
import { AdminUsersQueryDto } from "./dto/admin-users-query.dto";
import { AuthenticatedRequest } from "../common/types/authenticated-request";

@ApiTags("admin users")
@Throttle({ default: { limit: getAdminThrottleLimit(), ttl: 60000 } })
@Controller("api/v1/admin/users")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("ADMIN")
@ApiBearerAuth()
export class AdminUsersController {
  constructor(private readonly authService: AuthService) {}

  @Post()
  @RequirePermission("users.manage")
  @ApiOperation({ summary: "Create a new Admin or Staff account (Admin)" })
  @ApiResponse({ status: 201, description: "Admin user created successfully." })
  @ApiResponse({ status: 409, description: "User already exists." })
  async createAdmin(
    @Body() dto: CreateAdminDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.authService.createAdminUser(dto, req.user!.id);
  }

  @Get()
  @RequirePermission("users.manage")
  @ApiOperation({ summary: "List all users (Admin)" })
  @ApiResponse({ status: 200, description: "Paginated list of users returned." })
  async findAll(@Query() query: AdminUsersQueryDto) {
    return this.authService.findAllUsers(
      { page: query.page, limit: query.limit },
      query.search,
      query.role,
    );
  }

  @Get(":id")
  @RequirePermission("users.manage")
  @ApiOperation({ summary: "Get user details by ID (Admin)" })
  @ApiResponse({ status: 200, description: "User details returned." })
  @ApiResponse({ status: 404, description: "User not found." })
  async findOne(@Param("id") id: string) {
    return this.authService.findUserByIdForAdmin(id);
  }
}
