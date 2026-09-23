import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { UpdateStaticPageDto } from "./dto/update-static-page.dto";
import { StaticPagesService } from "./static-pages.service";

@ApiTags("static-pages")
@Controller(["static-pages", "api/v1/static-pages"])
export class StaticPagesController {
  constructor(private readonly staticPagesService: StaticPagesService) {}

  @Get(":slug")
  @ApiOperation({ summary: "Get static page by slug (Public)" })
  @ApiResponse({ status: 200, description: "Static page returned." })
  @ApiResponse({ status: 404, description: "Static page not found or not published." })
  async findBySlug(@Param("slug") slug: string) {
    return this.staticPagesService.findBySlug(slug);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles("ADMIN")
  @RequirePermission("settings.manage")
  @ApiBearerAuth()
  @ApiOperation({ summary: "List all static pages (Admin)" })
  @ApiResponse({ status: 200, description: "All static pages returned." })
  @ApiResponse({ status: 401, description: "Unauthorized." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  async findAllAdmin() {
    return this.staticPagesService.findAllAdmin();
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles("ADMIN")
  @RequirePermission("settings.manage")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update static page title/content/isPublished (Admin)" })
  @ApiResponse({ status: 200, description: "Static page updated successfully." })
  @ApiResponse({ status: 401, description: "Unauthorized." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiResponse({ status: 404, description: "Static page not found." })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateStaticPageDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.staticPagesService.update(id, dto, req.user?.id);
  }
}
