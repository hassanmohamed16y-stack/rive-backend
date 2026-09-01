import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductsService } from './products.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { UpdateProductDto } from './dto/update-product.dto';

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
  async findAll(
    @Query('category') category?: string,
    @Query('isFeatured') isFeatured?: string,
    @Query('search') search?: string,
    @Query() pagination: PaginationDto = new PaginationDto(),
  ) {
    return this.productsService.findAll(
      { category, isFeatured, search },
      { page: pagination.page, limit: pagination.limit },
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
  async create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update product details (Admin)' })
  @ApiResponse({ status: 200, description: 'Product updated successfully.' })
  async update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Archive a product without deleting order history (Admin)' })
  @ApiResponse({ status: 200, description: 'Product archived successfully.' })
  async archive(@Param('id') id: string) {
    return this.productsService.archive(id);
  }
}
