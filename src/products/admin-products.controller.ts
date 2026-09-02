import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ProductStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ProductsService } from './products.service';

@ApiTags('admin products')
@Controller('api/v1/admin/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List products in every status (Admin)' })
  @ApiQuery({ name: 'status', required: false, enum: ProductStatus })
  @ApiResponse({ status: 200, description: 'Paginated products returned.', schema: { properties: { data: { type: 'array', items: { type: 'object' } }, meta: { type: 'object' } } } })
  async findAll(@Query('status') status: ProductStatus | undefined, @Query() pagination: PaginationDto) {
    return this.productsService.findAll({ status }, { page: pagination.page, limit: pagination.limit }, true);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a product in any status by id (Admin)' })
  @ApiResponse({ status: 200, description: 'Product returned successfully.' })
  @ApiResponse({ status: 404, description: 'Product not found.' })
  async findOne(@Param('id') id: string) {
    return this.productsService.findByIdForAdmin(id);
  }
}
