import { Controller, Get, Param, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { getPublicReadThrottleLimit } from "../common/utils/throttling";
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ListCollectionsQueryDto } from "./dto/list-collections-query.dto";
import { CollectionsService } from "./collections.service";

@ApiTags("collections")
@Controller("api/v1/collections")
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get()
  @Throttle({ default: { limit: getPublicReadThrottleLimit(), ttl: 60000 } })
  @ApiOperation({ summary: "List all active collections" })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({ name: "isFeatured", required: false, type: Boolean })
  @ApiResponse({ status: 200, description: "Paginated collections returned." })
  async findAll(@Query() query: ListCollectionsQueryDto) {
    return this.collectionsService.findAll(
      { search: query.search, isFeatured: query.isFeatured },
      { page: query.page, limit: query.limit },
    );
  }

  @Get(":slug")
  @Throttle({ default: { limit: getPublicReadThrottleLimit(), ttl: 60000 } })
  @ApiOperation({ summary: "Get collection details by slug" })
  @ApiResponse({ status: 200, description: "Collection returned." })
  @ApiResponse({ status: 404, description: "Collection not found." })
  async findOne(@Param("slug") slug: string) {
    return this.collectionsService.findOneBySlug(slug);
  }
}
