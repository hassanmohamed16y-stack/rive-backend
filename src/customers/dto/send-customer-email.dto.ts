import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, Length } from "class-validator";

export class SendCustomerEmailDto {
  @ApiProperty({ example: "Important update regarding your account" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @Length(1, 150)
  subject!: string;

  @ApiProperty({ example: "Hello, we have updated our policy..." })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @Length(1, 5000)
  message!: string;
}
