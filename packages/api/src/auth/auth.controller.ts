import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
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
  RequestEmailVerificationDto,
  SessionResponseDto,
  SuccessResponseDto,
  TelegramMiniAppSessionDto,
  UpdateUserDto,
  UploadUserAvatarDto,
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
import {
  createClearTelegramStateCookie,
  createTelegramStateCookie,
  parseTelegramStateCookie,
} from "./telegram-state-cookie";

function getWebRedirectUrl(returnTo: string): string {
  const baseUrl = process.env.WEB_APP_URL?.trim() || "http://localhost:3000";
  return new URL(returnTo, baseUrl).toString();
}

function isLocalhost(hostname: string | undefined): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

function getTelegramCallbackRelayUrl(
  request: Request,
  input: {
    code: string | undefined;
    state: string | undefined;
    error: string | undefined;
  }
): string | null {
  if (process.env.NODE_ENV === "production" || isLocalhost(request.hostname)) return null;

  const webUrl = new URL(process.env.WEB_APP_URL?.trim() || "http://localhost:3000");
  if (!isLocalhost(webUrl.hostname)) return null;

  const redirectUrl = new URL(`http://localhost:${process.env.PORT?.trim() || "4000"}/auth/telegram/callback`);
  const query = new URLSearchParams();
  if (input.code) query.set("code", input.code);
  if (input.state) query.set("state", input.state);
  if (input.error) query.set("error", input.error);
  redirectUrl.search = query.toString();
  return redirectUrl.toString();
}

function getHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

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

  @Post("telegram-mini/session")
  @HttpCode(200)
  @ApiOperation({
    operationId: "createTelegramMiniAppSession",
    summary: "Create a session from Telegram Mini App data",
  })
  @ApiBody({ type: TelegramMiniAppSessionDto })
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
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiServiceUnavailableResponse({ type: ApiErrorDto })
  async createTelegramMiniAppSession(
    @Body() body: TelegramMiniAppSessionDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.authService.createTelegramMiniAppSession(body, {
      origin: getHeaderValue(request.headers.origin),
      referer: getHeaderValue(request.headers.referer),
      requestId:
        getHeaderValue(request.headers["x-request-id"]) ??
        getHeaderValue(request.headers["x-railway-request-id"]) ??
        getHeaderValue(request.headers["cf-ray"]),
      userAgent: getHeaderValue(request.headers["user-agent"]),
    });
    response.setHeader("Set-Cookie", createSessionCookie(result.token));
    return { user: result.user };
  }

  @Get("telegram/start")
  @ApiOperation({ operationId: "startTelegramAuth", summary: "Start Telegram OIDC authentication" })
  @ApiQuery({ name: "returnTo", required: false, type: String })
  @ApiServiceUnavailableResponse({ type: ApiErrorDto })
  async startTelegramAuth(@Query("returnTo") returnTo: string | undefined, @Res() response: Response) {
    const result = this.authService.startTelegramLogin(returnTo);
    response.setHeader("Set-Cookie", createTelegramStateCookie(result.stateCookieValue, result.ttlSeconds));
    response.redirect(result.authorizationUrl);
  }

  @Get("telegram/link/start")
  @UseGuards(AuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ operationId: "startTelegramLink", summary: "Start Telegram account linking" })
  @ApiQuery({ name: "returnTo", required: false, type: String })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiServiceUnavailableResponse({ type: ApiErrorDto })
  async startTelegramLink(
    @CurrentUser() user: AuthenticatedUser,
    @Query("returnTo") returnTo: string | undefined,
    @Res() response: Response
  ) {
    const result = this.authService.startTelegramLink(user.id, returnTo);
    response.setHeader("Set-Cookie", createTelegramStateCookie(result.stateCookieValue, result.ttlSeconds));
    response.redirect(result.authorizationUrl);
  }

  @Get("telegram/callback")
  @ApiOperation({ operationId: "completeTelegramAuth", summary: "Complete Telegram OIDC authentication" })
  @ApiQuery({ name: "code", required: false, type: String })
  @ApiQuery({ name: "state", required: false, type: String })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiConflictResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  async completeTelegramAuth(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Req() request: Request,
    @Res() response: Response
  ) {
    const relayUrl = getTelegramCallbackRelayUrl(request, { code, state, error });
    if (relayUrl) {
      response.redirect(relayUrl);
      return;
    }

    response.setHeader("Set-Cookie", createClearTelegramStateCookie());

    if (error || !code || !state) {
      response.redirect(
        getWebRedirectUrl(`/login?telegramError=${encodeURIComponent(error || "telegram_auth_failed")}`)
      );
      return;
    }

    const result = await this.authService.completeTelegramCallback({
      code,
      state,
      stateCookieValue: parseTelegramStateCookie(request.headers.cookie),
    });

    if (result.token) {
      response.setHeader("Set-Cookie", [createClearTelegramStateCookie(), createSessionCookie(result.token)]);
    }
    response.redirect(getWebRedirectUrl(result.returnTo));
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

  @Post("user/avatar")
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor("file"))
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ operationId: "uploadUserAvatar", summary: "Upload current user avatar" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({ type: UploadUserAvatarDto })
  @ApiOkResponse({ type: AuthUserResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiServiceUnavailableResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  async uploadUserAvatar(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file?: Express.Multer.File) {
    return { user: await this.authService.uploadUserAvatar(user.id, file) };
  }

  @Delete("user/avatar")
  @UseGuards(AuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ operationId: "deleteUserAvatar", summary: "Clear current user avatar" })
  @ApiOkResponse({ type: AuthUserResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  async deleteUserAvatar(@CurrentUser() user: AuthenticatedUser) {
    return { user: await this.authService.deleteUserAvatar(user.id) };
  }

  @Get("users/:userId/avatar")
  @ApiOperation({ operationId: "getUserAvatar", summary: "Redirect to the current uploaded user avatar object" })
  @ApiParam({ name: "userId", type: String })
  @ApiFoundResponse({
    description: "Redirects to a short-lived private bucket URL.",
    headers: {
      Location: {
        description: "Short-lived presigned avatar object URL.",
        schema: { type: "string" },
      },
    },
    schema: { type: "string" },
  })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiServiceUnavailableResponse({ type: ApiErrorDto })
  async getUserAvatar(@Param("userId") userId: string, @Res() response: Response) {
    const url = await this.authService.getUserAvatarReadUrl(userId);
    response.setHeader("Cache-Control", "no-store, max-age=0");
    response.redirect(url);
  }

  @Post("email")
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ operationId: "requestEmailVerification", summary: "Request verification for current user email" })
  @ApiBody({ type: RequestEmailVerificationDto })
  @ApiOkResponse({ type: SuccessResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiConflictResponse({ type: ApiErrorDto })
  @ApiServiceUnavailableResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  async requestEmailVerification(@CurrentUser() user: AuthenticatedUser, @Body() body: RequestEmailVerificationDto) {
    return this.authService.requestEmailVerification(user.id, body);
  }

  @Delete("telegram/link")
  @UseGuards(AuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ operationId: "unlinkTelegram", summary: "Unlink Telegram from the current user" })
  @ApiOkResponse({ type: AuthUserResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  async unlinkTelegram(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.unlinkTelegram(user.id);
  }
}
