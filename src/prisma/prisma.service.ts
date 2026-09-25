import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

const SOFT_DELETE_MODELS = new Set(["Product", "Order", "User"]);

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
    this.registerSoftDeleteMiddleware();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  private registerSoftDeleteMiddleware() {
    this.$use(async (params, next) => {
      if (!params.model || !SOFT_DELETE_MODELS.has(params.model)) {
        return next(params);
      }

      // Ensure params.args is an object
      params.args = params.args || {};
      const includeDeleted = params.args.includeDeleted === true;
      delete params.args.includeDeleted;

      // Handle soft delete mutation: convert delete -> update, deleteMany -> updateMany
      if (params.action === "delete") {
        params.action = "update";
        params.args = {
          ...params.args,
          data: { deletedAt: new Date() },
        };
      } else if (params.action === "deleteMany") {
        params.action = "updateMany";
        params.args = {
          ...params.args,
          where: params.args.where || {},
          data: { deletedAt: new Date() },
        };
      } else if (
        [
          "findUnique",
          "findUniqueOrThrow",
          "findFirst",
          "findFirstOrThrow",
          "findMany",
          "count",
          "aggregate",
          "groupBy",
        ].includes(params.action)
      ) {
        if (!includeDeleted) {
          if (params.action === "findUnique") {
            // findUnique only supports simple primary/unique key where criteria.
            // Convert to findFirst to support composite filters like { id: x, deletedAt: null }.
            params.action = "findFirst";
          } else if (params.action === "findUniqueOrThrow") {
            params.action = "findFirstOrThrow";
          }
          params.args.where = {
            ...params.args.where,
            deletedAt: null,
          };
        }
      }

      return next(params);
    });
  }
}
