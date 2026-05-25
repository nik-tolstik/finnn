import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from "class-validator";

export class CreateWorkspaceDto {
  @ApiProperty({ example: "Personal budget", maxLength: 100, minLength: 1, type: String })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: "personal-budget", maxLength: 50, minLength: 1, type: String })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/)
  slug!: string;
}

export class UpdateWorkspaceDto {
  @ApiPropertyOptional({ example: "Family budget", maxLength: 100, minLength: 1, type: String })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: "family-budget", maxLength: 50, minLength: 1, type: String })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/)
  slug?: string;

  @ApiPropertyOptional({ example: "wallet", nullable: true, type: String })
  @IsOptional()
  @IsString()
  icon?: string | null;
}

export class WorkspaceOwnerDto {
  @ApiProperty({ example: "665f5d865ef5a20c0d2f1111", type: String })
  id!: string;

  @ApiProperty({ example: "Finn User", nullable: true, type: String })
  name!: string | null;

  @ApiProperty({ example: "user@example.com", type: String })
  email!: string;

  @ApiPropertyOptional({ example: "avatar-01", nullable: true, type: String })
  image!: string | null;
}

export class WorkspaceMemberDto {
  @ApiProperty({ example: "665f5d865ef5a20c0d2f3333", type: String })
  id!: string;

  @ApiProperty({ example: "Finn User", nullable: true, type: String })
  name!: string | null;

  @ApiProperty({ example: "user@example.com", type: String })
  email!: string;

  @ApiPropertyOptional({ example: "avatar-01", nullable: true, type: String })
  image!: string | null;

  @ApiProperty({ example: "owner", enum: ["owner", "admin", "member"], type: String })
  role!: string;
}

export class WorkspaceSummaryDto {
  @ApiProperty({ example: "665f5d865ef5a20c0d2f2222", type: String })
  id!: string;

  @ApiProperty({ example: "Personal budget", type: String })
  name!: string;

  @ApiProperty({ example: "personal-budget", type: String })
  slug!: string;

  @ApiPropertyOptional({ example: "wallet", nullable: true, type: String })
  icon!: string | null;

  @ApiProperty({ example: "BYN", type: String })
  baseCurrency!: string;

  @ApiProperty({ example: "665f5d865ef5a20c0d2f1111", type: String })
  ownerId!: string;

  @ApiProperty({ example: 3, type: Number })
  membersCount!: number;

  @ApiProperty({ type: WorkspaceOwnerDto })
  owner!: WorkspaceOwnerDto;
}

export class WorkspaceDetailDto extends WorkspaceSummaryDto {
  @ApiProperty({ type: [WorkspaceMemberDto] })
  members!: WorkspaceMemberDto[];
}

export class WorkspaceListResponseDto {
  @ApiProperty({ type: [WorkspaceSummaryDto] })
  workspaces!: WorkspaceSummaryDto[];
}

export class WorkspaceResponseDto {
  @ApiProperty({ type: WorkspaceDetailDto })
  workspace!: WorkspaceDetailDto;
}

export class WorkspaceSummaryResponseDto {
  @ApiProperty({ type: WorkspaceSummaryDto })
  workspace!: WorkspaceSummaryDto;
}

export class WorkspaceMembersResponseDto {
  @ApiProperty({ type: [WorkspaceMemberDto] })
  members!: WorkspaceMemberDto[];
}

export class LeaveWorkspaceResponseDto {
  @ApiProperty({ example: true, type: Boolean })
  success!: boolean;
}

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
