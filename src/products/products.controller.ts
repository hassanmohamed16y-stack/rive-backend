import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthenticatedRequest } from '../common/types/authenticated-request';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@Controller('api/v1/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List all products with filters and pagination' })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'isFeatured', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (1-indexed)', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page', example: 20 })
  @ApiResponse({ status: 200, schema: { properties: { data: { type: 'array', items: { type: 'object' } }, meta: { type: 'object', properties: { page: { type: 'number' }, limit: { type: 'number' }, total: { type: 'number' }, totalPages: { type: 'number' } } } } } })
  async findAll(@Query() query: ListProductsQueryDto) {
    return this.productsService.findAll(
      { category: query.category, isFeatured: query.isFeatured, search: query.search },
      { page: query.page, limit: query.limit },
    );
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get a single product with full details' })
  @ApiResponse({ status: 200, description: 'Active product returned.' })
  @ApiResponse({ status: 404, description: 'Product not found.' })
  async findOne(@Param('slug') slug: string) {
    return this.productsService.findOneBySlug(slug);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a product with variants and images' })
  @ApiResponse({ status: 201, description: 'Product created successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden. ADMIN role required.' })
  @ApiResponse({ status: 404, description: 'Category not found.' })
  @ApiResponse({ status: 409, description: 'A product with this slug or a variant with this SKU already exists.' })
  async create(@Body() dto: CreateProductDto, @Req() req: AuthenticatedRequest) {
    return this.productsService.create(dto, req.user!.id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update product details (Admin)' })
  @ApiResponse({ status: 200, description: 'Product updated successfully.' })
  @ApiResponse({ status: 404, description: 'Product not found.' })
  @ApiResponse({ status: 409, description: 'A product with this slug already exists.' })
  async update(@Param('id') id: string, @Body() dto: UpdateProductDto, @Req() req: AuthenticatedRequest) {
    return this.productsService.update(id, dto, req.user!.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Archive a product without deleting order history (Admin)' })
  @ApiResponse({ status: 200, description: 'Product archived successfully.' })
  @ApiResponse({ status: 404, description: 'Product not found.' })
  async archive(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.productsService.archive(id, req.user!.id);
  }
}
