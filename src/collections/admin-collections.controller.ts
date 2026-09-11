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
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { PaginationDto } from "../common/dto/pagination.dto";
import { AuthenticatedRequest } from "../common/types/authenticated-request";
import { CollectionsService } from "./collections.service";
import { CreateCollectionDto } from "./dto/create-collection.dto";
import { UpdateCollectionDto } from "./dto/update-collection.dto";

@ApiTags("admin collections")
@Controller("api/v1/admin/collections")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
@ApiBearerAuth()
export class AdminCollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get()
  @ApiOperation({ summary: "List collections (Admin)" })
  async findAll(
    @Query("search") search?: string,
    @Query("isFeatured") isFeatured?: boolean,
    @Query() pagination?: PaginationDto,
  ) {
    return this.collectionsService.findAll(
      { search, isFeatured },
      { page: pagination?.page, limit: pagination?.limit },
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Get collection by ID (Admin)" })
  async findOne(@Param("id") id: string) {
    return this.collectionsService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: "Create a new collection (Admin)" })
  async create(
    @Body() dto: CreateCollectionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.collectionsService.create(dto, req.user!.id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a collection (Admin)" })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateCollectionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.collectionsService.update(id, dto, req.user!.id);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a collection (Admin)" })
  async delete(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return this.collectionsService.delete(id, req.user!.id);
  }

  @Post(":id/products/:productId")
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
