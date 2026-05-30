import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class RegisterDto {
  @ApiProperty({ example: "Finn User", maxLength: 100, minLength: 1, type: String })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: "user@example.com", type: String })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "correct-horse-battery", minLength: 6, type: String })
  @IsString()
  @MinLength(6)
  password!: string;
}

export class LoginDto {
  @ApiProperty({ example: "user@example.com", type: String })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "correct-horse-battery", minLength: 1, type: String })
  @IsString()
  @MinLength(1)
  password!: string;
}

export class UpdateUserDto {
  @ApiProperty({ example: "Finn User", maxLength: 100, minLength: 1, type: String })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: "avatar-01", nullable: true, type: String })
  @IsOptional()
  @IsString()
  image!: string | null;
}

export class RequestEmailVerificationDto {
  @ApiProperty({ example: "user@example.com", type: String })
  @IsEmail()
  email!: string;
}

export class TelegramAuthStatusDto {
  @ApiProperty({ example: true, type: Boolean })
  linked!: boolean;

  @ApiPropertyOptional({ example: "finn_user", nullable: true, type: String })
  username!: string | null;

  @ApiPropertyOptional({ example: "Finn User", nullable: true, type: String })
  displayName!: string | null;

  @ApiPropertyOptional({ example: "https://t.me/i/userpic/320/example.jpg", nullable: true, type: String })
  photoUrl!: string | null;
}

export class AuthUserDto {
  @ApiProperty({ example: "665f5d865ef5a20c0d2f1111", type: String })
  id!: string;

  @ApiPropertyOptional({ example: "user@example.com", nullable: true, type: String })
  email!: string | null;

  @ApiPropertyOptional({ example: "Finn User", nullable: true, type: String })
  name!: string | null;

  @ApiPropertyOptional({ example: "avatar-01", nullable: true, type: String })
  image!: string | null;

  @ApiProperty({ type: TelegramAuthStatusDto })
  telegram!: TelegramAuthStatusDto;
}

export class SuccessResponseDto {
  @ApiProperty({ example: true, type: Boolean })
  success!: boolean;
}

export class VerifyEmailResponseDto extends SuccessResponseDto {
  @ApiProperty({ example: "665f5d865ef5a20c0d2f1111", type: String })
  userId!: string;
}

export class AuthUserResponseDto {
  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;
}

export class SessionResponseDto {
  @ApiProperty({ example: true, type: Boolean })
  authenticated!: boolean;

  @ApiPropertyOptional({ type: AuthUserDto, nullable: true })
  user!: AuthUserDto | null;
}
