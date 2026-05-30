import { ApiProperty } from "@nestjs/swagger";

export class ApiErrorDto {
  @ApiProperty({ example: 400, type: Number })
  statusCode!: number;

  @ApiProperty({ example: "Validation failed", type: String })
  message!: string;

  @ApiProperty({ example: "Bad Request", type: String })
  error!: string;

  @ApiProperty({ example: "/auth/register", type: String })
  path!: string;

  @ApiProperty({ example: "2026-05-25T12:00:00.000Z", format: "date-time", type: String })
  timestamp!: string;
}
