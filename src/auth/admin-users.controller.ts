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
import { Roles } from "./roles.decorator";
import { RolesGuard } from "./roles.guard";
import { AuthService } from "./auth.service";
import { CreateAdminDto } from "./dto/create-admin.dto";
import { AuthenticatedRequest } from "../common/types/authenticated-request";
import { PaginationDto } from "../common/dto/pagination.dto";

@ApiTags("admin users")
@Controller("api/v1/admin/users")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
@ApiBearerAuth()
export class AdminUsersController {
  constructor(private readonly authService: AuthService) {}

  @Post()
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
  @ApiOperation({ summary: "List all users (Admin)" })
  @ApiResponse({ status: 200, description: "Paginated list of users returned." })
  async findAll(
    @Query() pagination: PaginationDto,
    @Query("search") search?: string,
    @Query("role") role?: string,
  ) {
    return this.authService.findAllUsers(pagination, search, role);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get user details by ID (Admin)" })
  @ApiResponse({ status: 200, description: "User details returned." })
  @ApiResponse({ status: 404, description: "User not found." })
  async findOne(@Param("id") id: string) {
    return this.authService.findUserByIdForAdmin(id);
  }
}
