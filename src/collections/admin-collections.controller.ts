import {
  Body,
  Controller,
  Delete,
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
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AuthenticatedRequest } from "../common/types/authenticated-request";
import { CollectionsService } from "./collections.service";
import { CreateCollectionDto } from "./dto/create-collection.dto";
import { ListCollectionsQueryDto } from "./dto/list-collections-query.dto";
import { UpdateCollectionDto } from "./dto/update-collection.dto";

@ApiTags("admin collections")
@Controller("api/v1/admin/collections")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("ADMIN")
@ApiBearerAuth()
export class AdminCollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get()
  @RequirePermission("products.view")
  @ApiOperation({ summary: "List collections (Admin)" })
  async findAll(@Query() query: ListCollectionsQueryDto) {
    return this.collectionsService.findAll(
      { search: query.search, isFeatured: query.isFeatured },
      { page: query.page, limit: query.limit },
    );
  }

  @Get(":id")
  @RequirePermission("products.view")
  @ApiOperation({ summary: "Get collection by ID (Admin)" })
  async findOne(@Param("id") id: string) {
    return this.collectionsService.findById(id);
  }

  @Post()
  @RequirePermission("products.edit")
  @ApiOperation({ summary: "Create a new collection (Admin)" })
  async create(
    @Body() dto: CreateCollectionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.collectionsService.create(dto, req.user!.id);
  }

  @Patch(":id")
  @RequirePermission("products.edit")
  @ApiOperation({ summary: "Update a collection (Admin)" })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateCollectionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.collectionsService.update(id, dto, req.user!.id);
  }

  @Delete(":id")
  @RequirePermission("products.edit")
  @ApiOperation({ summary: "Delete a collection (Admin)" })
  async delete(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return this.collectionsService.delete(id, req.user!.id);
  }

  @Post(":id/products/:productId")
  @RequirePermission("products.edit")
  @ApiOperation({ summary: "Add a product to a collection (Admin)" })
  async addProduct(
    @Param("id") collectionId: string,
    @Param("productId") productId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.collectionsService.addProductToCollection(
      collectionId,
      productId,
      req.user!.id,
    );
  }

  @Delete(":id/products/:productId")
  @RequirePermission("products.edit")
  @ApiOperation({ summary: "Remove a product from a collection (Admin)" })
  async removeProduct(
    @Param("id") collectionId: string,
    @Param("productId") productId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.collectionsService.removeProductFromCollection(
      collectionId,
      productId,
      req.user!.id,
    );
  }
}
