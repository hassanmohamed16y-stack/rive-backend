import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@Controller('api/v1/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List all products with filters' })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'isFeatured', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, type: String })
  async findAll(
    @Query('category') category?: string,
    @Query('isFeatured') isFeatured?: string,
    @Query('search') search?: string,
  ) {
    return this.productsService.findAll({ category, isFeatured, search });
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get a single product with full details' })
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
}
