import { ApiProperty } from "@nestjs/swagger";

export class TelegramWebhookResponseDto {
  @ApiProperty({ example: true, type: Boolean })
  ok!: boolean;
}
