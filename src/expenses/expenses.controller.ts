import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AuthenticatedRequest } from "../common/types/authenticated-request";
import { CreateExpenseDto } from "./dto/create-expense.dto";
import { ListExpensesQueryDto } from "./dto/list-expenses-query.dto";
import { UpdateExpenseDto } from "./dto/update-expense.dto";
import { ExpensesService } from "./expenses.service";

@ApiTags("admin expenses")
@Controller(["api/admin/expenses", "api/v1/admin/expenses"])
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("ADMIN")
@RequirePermission("expenses.manage")
@ApiBearerAuth()
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @ApiOperation({ summary: "Create an operational expense (Admin)" })
  @ApiResponse({ status: 201, description: "Expense created." })
  async create(@Body() dto: CreateExpenseDto, @Req() req: AuthenticatedRequest) {
    return this.expensesService.create(dto, req.user!.id);
  }

  @Get()
  @ApiOperation({ summary: "List operational expenses (Admin)" })
  @ApiResponse({ status: 200, description: "Paginated list of expenses." })
  async findAll(@Query() query: ListExpensesQueryDto) {
    return this.expensesService.findAll(query);
  }

  @Get("monthly-total")
  @ApiOperation({ summary: "Get monthly total of operational expenses (Admin)" })
  @ApiResponse({ status: 200, description: "Monthly total summary." })
  async getMonthlyTotal(
    @Query("year") year?: number,
    @Query("month") month?: number,
  ) {
    return this.expensesService.getMonthlyTotal(
      year ? Number(year) : undefined,
      month ? Number(month) : undefined,
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Get expense by ID (Admin)" })
  @ApiResponse({ status: 200, description: "Expense found." })
  @ApiResponse({ status: 404, description: "Expense not found." })
  async findOne(@Param("id") id: string) {
    return this.expensesService.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update expense (Admin)" })
  @ApiResponse({ status: 200, description: "Expense updated." })
  @ApiResponse({ status: 404, description: "Expense not found." })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateExpenseDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.expensesService.update(id, dto, req.user!.id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Delete expense (Admin)" })
  @ApiResponse({ status: 200, description: "Expense deleted." })
  @ApiResponse({ status: 404, description: "Expense not found." })
  async remove(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return this.expensesService.remove(id, req.user!.id);
  }
}
