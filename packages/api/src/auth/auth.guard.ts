import { type CanActivate, type ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";

import { AuthService } from "./auth.service";
import type { AuthenticatedRequest } from "./auth.types";
import { parseSessionCookie } from "./session-cookie";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = parseSessionCookie(request.headers.cookie);
    const user = await this.authService.getUserBySessionToken(token);

    if (!token || !user) {
      throw new UnauthorizedException("Не авторизован");
    }

    request.user = user;
    request.sessionToken = token;
    return true;
  }
}
