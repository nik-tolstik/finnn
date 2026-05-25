import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsInt, IsOptional, Max, Min } from "class-validator";

export class CreateInviteDto {
  @ApiProperty({ example: "member@example.com", type: String })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ default: 7, maximum: 30, minimum: 1, type: Number })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  expiresInDays = 7;
}

export class WorkspaceInviteDto {
  @ApiProperty({ example: "665f5d865ef5a20c0d2f1111", type: String })
  id!: string;

  @ApiProperty({ example: "665f5d865ef5a20c0d2f2222", type: String })
  workspaceId!: string;

  @ApiProperty({ example: "member@example.com", type: String })
  email!: string;

  @ApiProperty({ example: "b6f13a6bead...", type: String })
  token!: string;

  @ApiProperty({ example: "2026-06-01T12:00:00.000Z", format: "date-time", type: String })
  expiresAt!: string;
}

export class CreateInviteResponseDto {
  @ApiProperty({ type: WorkspaceInviteDto })
  invite!: WorkspaceInviteDto;
}

export class WorkspaceInvitePreviewDto {
  @ApiProperty({ example: "member@example.com", type: String })
  email!: string;

  @ApiProperty({ example: "Personal budget", type: String })
  workspaceName!: string;

  @ApiProperty({ example: "665f5d865ef5a20c0d2f2222", type: String })
  workspaceId!: string;

  @ApiProperty({ example: "2026-06-01T12:00:00.000Z", format: "date-time", type: String })
  expiresAt!: string;
}

export class WorkspaceInvitePreviewResponseDto {
  @ApiProperty({ type: WorkspaceInvitePreviewDto })
  invite!: WorkspaceInvitePreviewDto;
}

export class AcceptInviteResponseDto {
  @ApiProperty({ example: true, type: Boolean })
  success!: boolean;

  @ApiProperty({ example: "665f5d865ef5a20c0d2f2222", type: String })
  workspaceId!: string;
}
