import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'a1b2c3...', maxLength: 512 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token!: string;

  @ApiProperty({ example: 'NewStrongPass123!', minLength: 8, maxLength: 128 })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Password must include at least one uppercase letter, lowercase letter, and number.',
  })
  newPassword!: string;
}
