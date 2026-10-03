import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class SendMetaMessageDto {
  @ApiProperty({
    description: "The reply message text sent to the customer",
    maxLength: 1000,
    example: "Hello! How can we assist you today?",
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: "Message text must not be empty" })
  @MaxLength(1000, { message: "Message text cannot exceed 1000 characters" })
  text!: string;
}
