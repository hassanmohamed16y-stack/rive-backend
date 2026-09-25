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
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { PaginationDto } from "../common/dto/pagination.dto";
import { AuthenticatedRequest } from "../common/types/authenticated-request";
import { BundlesService } from "./bundles.service";
import { CreateBundleDto } from "./dto/create-bundle.dto";
import { UpdateBundleDto } from "./dto/update-bundle.dto";

@ApiTags("admin bundles")
@Controller("api/v1/admin/bundles")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
@ApiBearerAuth()
export class AdminBundlesController {
  constructor(private readonly bundlesService: BundlesService) {}

  @Post()
  @ApiOperation({ summary: "Create a product bundle (Admin)" })
  @ApiResponse({ status: 201, description: "Bundle created successfully." })
  async create(
    @Body() dto: CreateBundleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.bundlesService.create(dto, req.user!.id);
  }

  @Get()
  @ApiOperation({ summary: "List all product bundles (Admin)" })
  async findAll(@Query() pagination: PaginationDto) {
    return this.bundlesService.findAllAdmin({ page: pagination.page, limit: pagination.limit });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get product bundle by id (Admin)" })
  async findOne(@Param("id") id: string) {
    return this.bundlesService.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update product bundle (Admin)" })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateBundleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.bundlesService.update(id, dto, req.user!.id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Delete product bundle (Admin)" })
  async remove(
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.bundlesService.remove(id, req.user!.id);
  }
}
