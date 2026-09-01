import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export class UpdateCategoryDto {
  @ApiPropertyOptional({ maxLength: 256 }) @IsOptional() @IsString() @MaxLength(256) name?: string;
  @ApiPropertyOptional({ maxLength: 256 }) @IsOptional() @IsString() @Length(1, 256) @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) slug?: string;
  @ApiPropertyOptional({ maxLength: 1000 }) @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isFeatured?: boolean;
}