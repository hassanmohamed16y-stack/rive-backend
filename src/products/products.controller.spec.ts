import { Test, TestingModule } from '@nestjs/testing';
import { Size } from '@prisma/client';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

describe('ProductsController', () => {
  let controller: ProductsController;
  let productsService: jest.Mocked<ProductsService>;

  beforeEach(async () => {
    const mockProductsService = {
      findAll: jest.fn(),
      findOneBySlug: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      archive: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [{ provide: ProductsService, useValue: mockProductsService }],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
    productsService = module.get(ProductsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('delegates to productsService.findAll with filters and pagination', async () => {
      const mockResult = {
        data: [{ id: 'prod-1', name: 'Silk Scarf', slug: 'silk-scarf' }],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };
      productsService.findAll.mockResolvedValue(mockResult as any);

      const query: ListProductsQueryDto = {
        category: 'accessories',
        isFeatured: 'true',
        search: 'scarf',
        page: 1,
        limit: 10,
      };

      const res = await controller.findAll(query);

      expect(productsService.findAll).toHaveBeenCalledWith(
        { category: 'accessories', isFeatured: 'true', search: 'scarf' },
        { page: 1, limit: 10 },
      );
      expect(res).toBe(mockResult);
    });
  });

  describe('findOne', () => {
    it('delegates to productsService.findOneBySlug', async () => {
      const mockProduct = { id: 'prod-1', name: 'Silk Scarf', slug: 'silk-scarf' };
      productsService.findOneBySlug.mockResolvedValue(mockProduct as any);

      const res = await controller.findOne('silk-scarf');

      expect(productsService.findOneBySlug).toHaveBeenCalledWith('silk-scarf');
      expect(res).toBe(mockProduct);
    });
  });

  describe('create', () => {
    it('creates product passing dto and authenticated user id', async () => {
      const dto: CreateProductDto = {
        name: 'Silk Scarf',
        slug: 'silk-scarf',
        description: 'Luxury scarf',
        categorySlug: 'accessories',
        price: 250.00,
        images: [{ url: 'https://example.com/scarf.png', isPrimary: true }],
        variants: [{ sku: 'SCARF-001', size: Size.S, price: 250.00 }],
      };
      const req = { user: { id: 'admin-123', role: 'ADMIN' } } as any;

      const createdProduct = { id: 'prod-1', ...dto };
      productsService.create.mockResolvedValue(createdProduct as any);

      const res = await controller.create(dto, req);

      expect(productsService.create).toHaveBeenCalledWith(dto, 'admin-123');
      expect(res).toBe(createdProduct);
    });
  });

  describe('update', () => {
    it('updates product passing id, dto, and authenticated user id', async () => {
      const dto: UpdateProductDto = { name: 'Updated Silk Scarf' };
      const req = { user: { id: 'admin-123', role: 'ADMIN' } } as any;

      const updatedProduct = { id: 'prod-1', name: 'Updated Silk Scarf' };
      productsService.update.mockResolvedValue(updatedProduct as any);

      const res = await controller.update('prod-1', dto, req);

      expect(productsService.update).toHaveBeenCalledWith('prod-1', dto, 'admin-123');
      expect(res).toBe(updatedProduct);
    });
  });

  describe('archive', () => {
    it('archives product passing id and authenticated user id', async () => {
      const req = { user: { id: 'admin-123', role: 'ADMIN' } } as any;
      const archivedResult = { id: 'prod-1', status: 'ARCHIVED' };
      productsService.archive.mockResolvedValue(archivedResult as any);

      const res = await controller.archive('prod-1', req);

      expect(productsService.archive).toHaveBeenCalledWith('prod-1', 'admin-123');
      expect(res).toBe(archivedResult);
    });
  });
});
