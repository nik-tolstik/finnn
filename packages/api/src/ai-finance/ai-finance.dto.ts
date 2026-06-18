import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsObject, IsOptional, IsString } from "class-validator";

export class AiFinanceTelegramUpdateDto {
  @ApiProperty({ type: Object })
  @IsObject()
  update!: Record<string, unknown>;
}

export class AiFinanceDraftPreviewDto {
  @ApiProperty({ type: String })
  draftId!: string;

  @ApiProperty({ type: String })
  status!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  currentQuestion!: string | null;

  @ApiProperty({ type: String })
  text!: string;
}

export class AiFinanceDraftActionDto {
  @ApiProperty({ type: String })
  @IsString()
  draftId!: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  value?: string;
}
