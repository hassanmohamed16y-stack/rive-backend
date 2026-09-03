import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ProductStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ProductsService } from './products.service';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';
import { AdjustProductVariantStockDto } from './dto/adjust-product-variant-stock.dto';

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

  @Post(':productId/variants')
  @ApiOperation({ summary: 'Create a product variant (Admin)' })
  async createVariant(@Param('productId') productId: string, @Body() dto: CreateProductVariantDto, @Req() req: { user: { id: string } }) {
    return this.productsService.createVariant(productId, dto, req.user.id);
  }

  @Patch(':productId/variants/:variantId')
  @ApiOperation({ summary: 'Update product variant price, color, or availability (Admin)' })
  async updateVariant(@Param('productId') productId: string, @Param('variantId') variantId: string, @Body() dto: UpdateProductVariantDto, @Req() req: { user: { id: string } }) {
    return this.productsService.updateVariant(productId, variantId, dto, req.user.id);
  }

  @Patch(':productId/variants/:variantId/stock')
  @ApiOperation({ summary: 'Atomically adjust product variant stock by a delta (Admin)' })
  async adjustVariantStock(@Param('productId') productId: string, @Param('variantId') variantId: string, @Body() dto: AdjustProductVariantStockDto, @Req() req: { user: { id: string } }) {
    return this.productsService.adjustVariantStock(productId, variantId, dto.adjustment, dto.reason, req.user.id);
  }

  @Delete(':productId/variants/:variantId')
  @ApiOperation({ summary: 'Delete an unreferenced product variant (Admin)' })
  async removeVariant(@Param('productId') productId: string, @Param('variantId') variantId: string, @Req() req: { user: { id: string } }) {
    await this.productsService.removeVariant(productId, variantId, req.user.id);
  }
}
