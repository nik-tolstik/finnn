import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";

import type { AuthenticatedRequest } from "./auth.types";

export const EMAIL_VERIFICATION_REQUIRED_CODE = "EMAIL_VERIFICATION_REQUIRED";
export const EMAIL_VERIFICATION_REQUIRED_MESSAGE = "Подтвердите email, чтобы продолжить";

@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (request.user.emailVerified) {
      return true;
    }

    throw new ForbiddenException({
      statusCode: 403,
      message: EMAIL_VERIFICATION_REQUIRED_MESSAGE,
      error: "Forbidden",
      code: EMAIL_VERIFICATION_REQUIRED_CODE,
    });
  }
}
