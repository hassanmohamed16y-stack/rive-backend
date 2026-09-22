import {
  Body,
  Controller,
  Get,
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
import { JwtAuthGuard } from "./jwt-auth.guard";
import { PermissionsGuard } from "./permissions.guard";
import { RequirePermission } from "./permissions.decorator";
import { UsersService } from "./users.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { AuthenticatedRequest } from "../common/types/authenticated-request";
import { PaginationDto } from "../common/dto/pagination.dto";

@ApiTags("users")
@Controller(["api/v1/users", "users"])
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission("users.manage")
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: "List all users with their role and status" })
  @ApiResponse({ status: 200, description: "Paginated list of users returned." })
  async findAll(
    @Query() pagination: PaginationDto,
    @Query("search") search?: string,
    @Query("roleId") roleId?: string,
  ) {
    return this.usersService.findAllUsers(pagination, search, roleId);
  }

  @Post()
  @ApiOperation({ summary: "Create a new user" })
  @ApiResponse({ status: 201, description: "User created successfully." })
  @ApiResponse({ status: 409, description: "User already exists." })
  async create(
    @Body() dto: CreateUserDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.createUser(dto, req.user!.id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update user details, role, or active status" })
  @ApiResponse({ status: 200, description: "User updated successfully." })
  @ApiResponse({ status: 403, description: "Cannot change own role." })
  @ApiResponse({ status: 404, description: "User not found." })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.updateUser(id, dto, req.user!);
  }

  @Patch(":id/disable")
  @ApiOperation({ summary: "Soft-disable a user (isActive = false)" })
  @ApiResponse({ status: 200, description: "User soft-disabled successfully." })
  @ApiResponse({ status: 400, description: "Cannot disable last remaining Full Admin." })
  async disable(
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.disableUser(id, req.user!);
  }
}
