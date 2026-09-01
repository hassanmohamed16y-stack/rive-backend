import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Aisha Rahman', minLength: 2, maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @ApiProperty({ example: 'aisha@example.com', maxLength: 254 })
  @IsEmail()
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'StrongPass123!', minLength: 8, maxLength: 128 })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Password must include at least one uppercase letter, lowercase letter, and number.',
  })
  password!: string;
}
