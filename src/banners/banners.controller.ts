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
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiConsumes,
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
import { UploadedImageFile } from "../upload/uploaded-image-file.type";
import { BannersService } from "./banners.service";
import { CreateBannerDto } from "./dto/create-banner.dto";
import { UpdateBannerDto } from "./dto/update-banner.dto";

@ApiTags("banners")
@Controller(["banners", "api/v1/banners"])
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Get()
  @ApiOperation({
    summary:
      "Get active promotional banners for storefront (Public)",
  })
  @ApiResponse({
    status: 200,
    description: "Active banners returned successfully.",
  })
  async findActive() {
    return this.bannersService.findActive();
  }

  @Get("admin")
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles("ADMIN")
  @RequirePermission("settings.manage")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Get all banners for dashboard management (Admin)",
  })
  @ApiResponse({
    status: 200,
    description: "All banners returned successfully.",
  })
  @ApiResponse({ status: 401, description: "Unauthorized." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  async findAllAdmin() {
    return this.bannersService.findAllAdmin();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles("ADMIN")
  @RequirePermission("settings.manage")
  @ApiBearerAuth()
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  @ApiConsumes("multipart/form-data", "application/json")
  @ApiOperation({ summary: "Create a new banner (Admin)" })
  @ApiResponse({ status: 201, description: "Banner created successfully." })
  @ApiResponse({ status: 400, description: "Bad request / Validation error." })
  @ApiResponse({ status: 401, description: "Unauthorized." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  async create(
    @Body() dto: CreateBannerDto,
    @UploadedFile() file: UploadedImageFile | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.bannersService.create(dto, file, req.user?.id);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles("ADMIN")
  @RequirePermission("settings.manage")
  @ApiBearerAuth()
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  @ApiConsumes("multipart/form-data", "application/json")
  @ApiOperation({ summary: "Update an existing banner (Admin)" })
  @ApiResponse({ status: 200, description: "Banner updated successfully." })
  @ApiResponse({ status: 400, description: "Bad request / Validation error." })
  @ApiResponse({ status: 401, description: "Unauthorized." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiResponse({ status: 404, description: "Banner not found." })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateBannerDto,
    @UploadedFile() file: UploadedImageFile | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.bannersService.update(id, dto, file, req.user?.id);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles("ADMIN")
  @RequirePermission("settings.manage")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Hard-delete a banner (Admin)" })
  @ApiResponse({ status: 200, description: "Banner deleted successfully." })
  @ApiResponse({ status: 401, description: "Unauthorized." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiResponse({ status: 404, description: "Banner not found." })
  async delete(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return this.bannersService.delete(id, req.user?.id);
  }
}
