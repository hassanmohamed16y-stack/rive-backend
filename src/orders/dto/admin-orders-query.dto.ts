import { ApiPropertyOptional } from "@nestjs/swagger";
import { OrderStatus, PaymentStatus } from "@prisma/client";
import { Transform } from "class-transformer";
import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from "class-validator";
import { PaginationDto } from "../../common/dto/pagination.dto";

function IsDateBeforeOrEqual(
  property: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: "isDateBeforeOrEqual",
      target: object.constructor,
      propertyName: propertyName,
      constraints: [property],
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints;
          const relatedValue = (args.object as any)[relatedPropertyName];
          if (!value || !relatedValue) {
            return true;
          }
          const start = new Date(value);
          const end = new Date(relatedValue);
          if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return true;
          }
          return start <= end;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must not be later than ${args.constraints[0]}`;
        },
      },
    });
  };
}

export class AdminOrdersQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: "Filter orders by status",
    enum: OrderStatus,
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === "" || value === null || value === undefined ? undefined : value,
  )
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({
    description:
      "Filter orders by payment status. Values: PENDING, PAID, FAILED, REFUNDED",
    enum: PaymentStatus,
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === "" || value === null || value === undefined ? undefined : value,
  )
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional({
    description:
      "Search keyword matching orderNumber, customerName, or customerEmail (max 100 characters)",
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string"
      ? value.trim() === ""
        ? undefined
        : value.trim()
      : value,
  )
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    description: "Filter orders created on or after ISO date string (startDate)",
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === "" || value === null || value === undefined ? undefined : value,
  )
  @IsISO8601()
  @IsDateBeforeOrEqual("endDate", {
    message: "startDate must not be later than endDate",
  })
  startDate?: string;

  @ApiPropertyOptional({
    description: "Filter orders created on or before ISO date string (endDate)",
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === "" || value === null || value === undefined ? undefined : value,
  )
  @IsISO8601()
  endDate?: string;
}
