import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ProductStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreateProductImageDto } from './dto/create-product-image.dto';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';
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

  @Post(':productId/variants')
  @ApiOperation({ summary: 'Add a variant to a product (Admin)' })
  @ApiResponse({ status: 201, description: 'Variant created successfully.' })
  @ApiResponse({ status: 404, description: 'Product not found.' })
  @ApiResponse({ status: 409, description: 'A variant with this SKU already exists.' })
  async addVariant(@Param('productId') productId: string, @Body() dto: CreateProductVariantDto, @Req() req: any) {
    return this.productsService.addVariant(productId, dto, req.user.id);
  }

  @Patch(':productId/variants/:variantId')
  @ApiOperation({ summary: 'Partially update a product variant (stock/price/availability/color/size) (Admin)' })
  @ApiResponse({ status: 200, description: 'Variant updated successfully.' })
  @ApiResponse({ status: 404, description: 'Product or variant not found.' })
  @ApiResponse({ status: 409, description: 'Variant was modified concurrently, or SKU conflict.' })
  async updateVariant(
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateProductVariantDto,
    @Req() req: any,
  ) {
    return this.productsService.updateVariant(productId, variantId, dto, req.user.id);
  }

  @Delete(':productId/variants/:variantId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a product variant that has no order history (Admin)' })
  @ApiResponse({ status: 200, description: 'Variant deleted successfully.' })
  @ApiResponse({ status: 404, description: 'Product or variant not found.' })
  @ApiResponse({ status: 409, description: 'Variant has existing order items and cannot be deleted.' })
  async removeVariant(@Param('productId') productId: string, @Param('variantId') variantId: string, @Req() req: any) {
    return this.productsService.removeVariant(productId, variantId, req.user.id);
  }

  @Post(':productId/images')
  @ApiOperation({ summary: 'Add an image to a product (Admin)' })
  @ApiResponse({ status: 201, description: 'Image created successfully.' })
  @ApiResponse({ status: 404, description: 'Product not found.' })
  async addImage(@Param('productId') productId: string, @Body() dto: CreateProductImageDto, @Req() req: any) {
    return this.productsService.addImage(productId, dto, req.user.id);
  }

  @Delete(':productId/images/:imageId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a product image (Admin)' })
  @ApiResponse({ status: 200, description: 'Image deleted successfully.' })
  @ApiResponse({ status: 404, description: 'Product or image not found.' })
  async removeImage(@Param('productId') productId: string, @Param('imageId') imageId: string, @Req() req: any) {
    return this.productsService.removeImage(productId, imageId, req.user.id);
  }
}
