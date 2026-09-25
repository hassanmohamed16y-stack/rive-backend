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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { PermissionsGuard } from "../auth/permissions.guard";
import { AuthenticatedRequest } from "../common/types/authenticated-request";
import { CreateInternalNoteDto } from "./dto/create-internal-note.dto";
import { UpdateInternalNoteDto } from "./dto/update-internal-note.dto";
import { InternalNotesService } from "./internal-notes.service";

@ApiTags("admin internal notes")
@Controller("api/v1/admin/internal-notes")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("ADMIN")
@ApiBearerAuth()
export class InternalNotesController {
  constructor(private readonly internalNotesService: InternalNotesService) {}

  @Post()
  @ApiOperation({ summary: "Create an internal note for an order or customer (Admin)" })
  @ApiResponse({ status: 201, description: "Internal note created successfully." })
  async create(
    @Body() dto: CreateInternalNoteDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.internalNotesService.create(dto, req.user!.id);
  }

  @Get()
  @ApiOperation({ summary: "List internal notes by entityType and/or entityId (Admin)" })
  @ApiQuery({ name: "entityType", required: false, type: String })
  @ApiQuery({ name: "entityId", required: false, type: String })
  @ApiResponse({ status: 200, description: "Internal notes returned." })
  async findAll(
    @Query("entityType") entityType?: string,
    @Query("entityId") entityId?: string,
  ) {
    return this.internalNotesService.findAll(entityType, entityId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get an internal note by ID (Admin)" })
  @ApiResponse({ status: 200, description: "Internal note returned." })
  @ApiResponse({ status: 404, description: "Internal note not found." })
  async findOne(@Param("id") id: string) {
    return this.internalNotesService.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update an internal note (Admin)" })
  @ApiResponse({ status: 200, description: "Internal note updated." })
  @ApiResponse({ status: 404, description: "Internal note not found." })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateInternalNoteDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.internalNotesService.update(id, dto, req.user!.id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Delete an internal note (Admin)" })
  @ApiResponse({ status: 200, description: "Internal note deleted." })
  @ApiResponse({ status: 404, description: "Internal note not found." })
  async remove(
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.internalNotesService.remove(id, req.user!.id);
  }
}
