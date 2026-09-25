import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CouponType } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { AuditLogService } from "../audit-log/audit-log.service";
import {
  buildPaginationMeta,
  PaginationInput,
  resolvePagination,
} from "../common/utils/pagination";
import { isPrismaErrorCode } from "../common/utils/prisma-error";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCouponDto } from "./dto/create-coupon.dto";
import { UpdateCouponDto } from "./dto/update-coupon.dto";

@Injectable()
export class CouponsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(dto: CreateCouponDto, actorUserId?: string) {
    const code = dto.code.trim().toUpperCase();
    try {
      const coupon = await this.prisma.coupon.create({
        data: {
          code,
          type: dto.type ?? CouponType.PERCENTAGE,
          value: dto.value,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
          usageLimit: dto.usageLimit ?? null,
          usagePerCustomer: dto.usagePerCustomer ?? null,
          minOrderAmount: dto.minOrderAmount ?? null,
          isActive: dto.isActive ?? true,
        },
      });

      await this.auditLogService.record({
        userId: actorUserId,
        action: "coupon.create",
        entityType: "Coupon",
        entityId: coupon.id,
        changes: dto,
      });

      return coupon;
    } catch (error) {
      if (isPrismaErrorCode(error, "P2002")) {
        throw new ConflictException(`Coupon with code "${code}" already exists`);
      }
      throw error;
    }
  }

  async findAll(pagination?: PaginationInput) {
    const { page, limit, skip, take } = resolvePagination(pagination);
    const [data, total] = await Promise.all([
      this.prisma.coupon.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      this.prisma.coupon.count(),
    ]);

    return { data, meta: buildPaginationMeta(page, limit, total) };
  }

  async findOne(id: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) {
      throw new NotFoundException(`Coupon ${id} was not found`);
    }
    return coupon;
  }

  async update(id: string, dto: UpdateCouponDto, actorUserId?: string) {
    await this.findOne(id);

    try {
      const updated = await this.prisma.coupon.update({
        where: { id },
        data: {
          ...(dto.code ? { code: dto.code.trim().toUpperCase() } : {}),
          ...(dto.type ? { type: dto.type } : {}),
          ...(dto.value !== undefined ? { value: dto.value } : {}),
          ...(dto.expiresAt !== undefined
            ? { expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null }
            : {}),
          ...(dto.usageLimit !== undefined ? { usageLimit: dto.usageLimit } : {}),
          ...(dto.usagePerCustomer !== undefined
            ? { usagePerCustomer: dto.usagePerCustomer }
            : {}),
          ...(dto.minOrderAmount !== undefined
            ? { minOrderAmount: dto.minOrderAmount }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });

      await this.auditLogService.record({
        userId: actorUserId,
        action: "coupon.update",
        entityType: "Coupon",
        entityId: updated.id,
        changes: dto,
      });

      return updated;
    } catch (error) {
      if (isPrismaErrorCode(error, "P2002")) {
        throw new ConflictException("A coupon with this code already exists");
      }
      throw error;
    }
  }

  async remove(id: string, actorUserId?: string) {
    await this.findOne(id);
    await this.prisma.coupon.delete({ where: { id } });

    await this.auditLogService.record({
      userId: actorUserId,
      action: "coupon.delete",
      entityType: "Coupon",
      entityId: id,
      changes: { deleted: true },
    });

    return { success: true };
  }

  async validateCoupon(code: string, subtotalInput: number) {
    const normalizedCode = code.trim().toUpperCase();
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: normalizedCode },
    });

    if (!coupon || !coupon.isActive) {
      throw new BadRequestException("Coupon is invalid or inactive");
    }

    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      throw new BadRequestException("Coupon has expired");
    }

    if (
      coupon.usageLimit !== null &&
      coupon.usageLimit !== undefined &&
      coupon.usageCount >= coupon.usageLimit
    ) {
      throw new BadRequestException("Coupon usage limit reached");
    }

    const subtotal = new Decimal(subtotalInput);
    if (
      coupon.minOrderAmount &&
      subtotal.lessThan(new Decimal(coupon.minOrderAmount))
    ) {
      throw new BadRequestException(
        `Minimum order amount for this coupon is ${coupon.minOrderAmount.toString()}`,
      );
    }

    const couponVal =
      typeof coupon.value === "object" && coupon.value !== null && "toNumber" in (coupon.value as any)
        ? (coupon.value as any).toNumber()
        : Number(coupon.value);

    let discountAmount = new Decimal(0);
    if (coupon.type === CouponType.PERCENTAGE) {
      discountAmount = subtotal.times(new Decimal(couponVal)).dividedBy(100);
    } else {
      discountAmount = Decimal.min(new Decimal(couponVal), subtotal);
    }

    return {
      valid: true,
      discountAmount: discountAmount.toNumber(),
      coupon: {
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        value: coupon.value.toNumber(),
      },
    };
  }
}
