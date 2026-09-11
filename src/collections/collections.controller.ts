import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { PaginationDto } from "../common/dto/pagination.dto";
import { CollectionsService } from "./collections.service";

@ApiTags("collections")
@Controller("api/v1/collections")
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get()
  @ApiOperation({ summary: "List all active collections" })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({ name: "isFeatured", required: false, type: Boolean })
  @ApiResponse({ status: 200, description: "Paginated collections returned." })
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

  @Get(":slug")
  @ApiOperation({ summary: "Get collection details by slug" })
  @ApiResponse({ status: 200, description: "Collection returned." })
  @ApiResponse({ status: 404, description: "Collection not found." })
  async findOne(@Param("slug") slug: string) {
    return this.collectionsService.findOneBySlug(slug);
  }
}
