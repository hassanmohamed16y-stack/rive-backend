import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditLogService } from "../audit-log/audit-log.service";
import { isPrismaErrorCode } from "../common/utils/prisma-error";
import { PrismaService } from "../prisma/prisma.service";
import { CreateShippingZoneDto } from "./dto/create-shipping-zone.dto";
import { UpdateShippingZoneDto } from "./dto/update-shipping-zone.dto";

/**
 * IMPORTANT NOTE FOR ORDER CREATION & CHECKOUT:
 * When calculating shipping cost during order creation, the price MUST be read
 * server-side directly from the ShippingZone record at order time (e.g. by matching
 * customer shippingCity against active ShippingZone records).
 * NEVER trust or accept a shipping fee or price value sent directly from any client.
 */
@Injectable()
export class ShippingZonesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Get all active shipping zones for public storefront checkout.
   */
  async findActiveZones() {
    return this.prisma.shippingZone.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { cityLabel: "asc" }],
    });
  }

  /**
   * Get all shipping zones (including inactive ones) for admin dashboard.
   */
  async findAllAdmin() {
    return this.prisma.shippingZone.findMany({
      orderBy: [{ sortOrder: "asc" }, { cityLabel: "asc" }],
    });
  }

  /**
   * Create a new shipping zone (Admin).
   */
  async create(dto: CreateShippingZoneDto, actorUserId?: string) {
    let zone;
    try {
      zone = await this.prisma.shippingZone.create({
        data: {
          cityLabel: dto.cityLabel,
          price: dto.price,
          estimatedDays: dto.estimatedDays ?? null,
          isActive: dto.isActive ?? true,
          sortOrder: dto.sortOrder ?? 0,
        },
      });
    } catch (error) {
      if (isPrismaErrorCode(error, "P2002")) {
        throw new ConflictException(
          `Shipping zone for city "${dto.cityLabel}" already exists`,
        );
      }
      throw error;
    }

    await this.auditLogService.record({
      userId: actorUserId,
      action: "shipping_zone.create",
      entityType: "ShippingZone",
      entityId: zone.id,
      changes: dto,
    });

    return zone;
  }

  /**
   * Update an existing shipping zone (Admin).
   */
  async update(
    id: string,
    dto: UpdateShippingZoneDto,
    actorUserId?: string,
  ) {
    let zone;
    try {
      zone = await this.prisma.shippingZone.update({
        where: { id },
        data: {
          ...(dto.cityLabel !== undefined ? { cityLabel: dto.cityLabel } : {}),
          ...(dto.price !== undefined ? { price: dto.price } : {}),
          ...(dto.estimatedDays !== undefined
            ? { estimatedDays: dto.estimatedDays }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        },
      });
    } catch (error) {
      if (isPrismaErrorCode(error, "P2025")) {
        throw new NotFoundException(`Shipping zone ${id} was not found`);
      }
      if (isPrismaErrorCode(error, "P2002")) {
        throw new ConflictException(
          `Shipping zone for city "${dto.cityLabel}" already exists`,
        );
      }
      throw error;
    }

    await this.auditLogService.record({
      userId: actorUserId,
      action: "shipping_zone.update",
      entityType: "ShippingZone",
      entityId: zone.id,
      changes: dto,
    });

    return zone;
  }

  /**
   * Soft-deactivate a shipping zone (isActive = false) (Admin).
   * Note: We never hard-delete shipping zones to maintain historical order integrity.
   */
  async deactivate(id: string, actorUserId?: string) {
    let zone;
    try {
      zone = await this.prisma.shippingZone.update({
        where: { id },
        data: { isActive: false },
      });
    } catch (error) {
      if (isPrismaErrorCode(error, "P2025")) {
        throw new NotFoundException(`Shipping zone ${id} was not found`);
      }
      throw error;
    }

    await this.auditLogService.record({
      userId: actorUserId,
      action: "shipping_zone.deactivate",
      entityType: "ShippingZone",
      entityId: zone.id,
      changes: { isActive: false },
    });

    return zone;
  }
}
