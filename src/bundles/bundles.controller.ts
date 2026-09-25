import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { PaginationDto } from "../common/dto/pagination.dto";
import { BundlesService } from "./bundles.service";

@ApiTags("bundles")
@Controller("api/v1/bundles")
export class BundlesController {
  constructor(private readonly bundlesService: BundlesService) {}

  @Get()
  @ApiOperation({ summary: "List active product bundles" })
  async findAllPublic(@Query() pagination: PaginationDto) {
    return this.bundlesService.findAllPublic({ page: pagination.page, limit: pagination.limit });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get product bundle details by id" })
  async findOne(@Param("id") id: string) {
    return this.bundlesService.findOne(id);
  }
}
