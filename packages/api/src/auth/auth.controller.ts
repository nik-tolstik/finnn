import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Req, Res, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { Request, Response } from "express";

import { ApiErrorDto } from "@/common/api-error.dto";

import {
  AuthUserResponseDto,
  LoginDto,
  RegisterDto,
  SessionResponseDto,
  SuccessResponseDto,
  UpdateUserDto,
  VerifyEmailResponseDto,
} from "./auth.dto";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import type { AuthenticatedUser } from "./auth.types";
import { CurrentUser } from "./current-user.decorator";
import {
  AUTH_COOKIE_NAME,
  createClearSessionCookie,
  createSessionCookie,
  parseSessionCookie,
  parseSessionCookies,
} from "./session-cookie";

@Controller("auth")
@ApiTags("Auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post("register")
  @ApiOperation({ operationId: "register", summary: "Start email-verified registration" })
  @ApiBody({ type: RegisterDto })
  @ApiCreatedResponse({ type: SuccessResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiConflictResponse({ type: ApiErrorDto })
  @ApiServiceUnavailableResponse({ type: ApiErrorDto })
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Post("verify-email/:token")
  @HttpCode(200)
  @ApiOperation({ operationId: "verifyEmail", summary: "Verify a pending registration email token" })
  @ApiParam({ name: "token", type: String })
  @ApiOkResponse({ type: VerifyEmailResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiConflictResponse({ type: ApiErrorDto })
  async verifyEmail(@Param("token") token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post("login")
  @HttpCode(200)
  @ApiOperation({ operationId: "login", summary: "Create an authenticated session cookie" })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({
    type: AuthUserResponseDto,
    headers: {
      "Set-Cookie": {
        description: `HTTP-only ${AUTH_COOKIE_NAME} session cookie`,
        schema: { type: "string" },
      },
    },
  })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.login(body);
    response.setHeader("Set-Cookie", createSessionCookie(result.token));
    return { user: result.user };
  }

  @Post("logout")
  @HttpCode(200)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ operationId: "logout", summary: "Invalidate the current session cookie" })
  @ApiOkResponse({ type: SuccessResponseDto })
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const token = parseSessionCookie(request.headers.cookie);
    const result = await this.authService.logout(token);
    response.setHeader("Set-Cookie", createClearSessionCookie());
    return result;
  }

  @Get("session")
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ operationId: "getSession", summary: "Read the current authenticated session" })
  @ApiOkResponse({ type: SessionResponseDto })
  async session(@Req() request: Request) {
    const tokens = parseSessionCookies(request.headers.cookie);
    const user = await this.authService.getUserBySessionTokens(tokens);
    return { authenticated: Boolean(user), user };
  }

  @Patch("user")
  @UseGuards(AuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ operationId: "updateUser", summary: "Update current user settings" })
  @ApiBody({ type: UpdateUserDto })
  @ApiOkResponse({ type: AuthUserResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  async updateUser(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateUserDto) {
    return { user: await this.authService.updateUser(user.id, body) };
  }
}
