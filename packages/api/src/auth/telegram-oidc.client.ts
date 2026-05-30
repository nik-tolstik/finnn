import { Buffer } from "node:buffer";
import { Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { createRemoteJWKSet, type JWTPayload, jwtVerify } from "jose";

const TELEGRAM_ISSUER = "https://oauth.telegram.org";
const TELEGRAM_TOKEN_ENDPOINT = "https://oauth.telegram.org/token";
const TELEGRAM_JWKS_ENDPOINT = "https://oauth.telegram.org/.well-known/jwks.json";

export type TelegramClaims = JWTPayload & {
  sub: string;
  name?: string;
  preferred_username?: string;
  picture?: string;
};

type TelegramTokenResponse = {
  id_token?: unknown;
};

function getRequiredTelegramEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new ServiceUnavailableException(`${name} is not configured`);
  }
  return value;
}

@Injectable()
export class TelegramOidcClient {
  private readonly jwks = createRemoteJWKSet(new URL(TELEGRAM_JWKS_ENDPOINT));

  getClientId(): string {
    return getRequiredTelegramEnv("TELEGRAM_CLIENT_ID");
  }

  getRedirectUri(): string {
    return getRequiredTelegramEnv("TELEGRAM_REDIRECT_URI");
  }

  getAuthorizationUrl(input: { codeChallenge: string; nonce: string; state: string }): string {
    const url = new URL(`${TELEGRAM_ISSUER}/auth`);
    url.searchParams.set("client_id", this.getClientId());
    url.searchParams.set("redirect_uri", this.getRedirectUri());
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid profile");
    url.searchParams.set("state", input.state);
    url.searchParams.set("nonce", input.nonce);
    url.searchParams.set("code_challenge", input.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
  }

  async exchangeCodeForClaims(input: { code: string; codeVerifier: string; nonce: string }): Promise<TelegramClaims> {
    const clientId = this.getClientId();
    const clientSecret = getRequiredTelegramEnv("TELEGRAM_CLIENT_SECRET");
    const response = await fetch(TELEGRAM_TOKEN_ENDPOINT, {
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: input.code,
        redirect_uri: this.getRedirectUri(),
        client_id: clientId,
        code_verifier: input.codeVerifier,
      }),
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
    });

    if (!response.ok) {
      throw new UnauthorizedException("Telegram authentication failed");
    }

    const tokenResponse = (await response.json()) as TelegramTokenResponse;
    if (typeof tokenResponse.id_token !== "string") {
      throw new UnauthorizedException("Telegram response did not include an ID token");
    }

    const result = await jwtVerify(tokenResponse.id_token, this.jwks, {
      audience: clientId,
      issuer: TELEGRAM_ISSUER,
    });

    if (result.payload.nonce !== input.nonce) {
      throw new UnauthorizedException("Telegram authentication nonce is invalid");
    }

    if (typeof result.payload.sub !== "string" || !result.payload.sub) {
      throw new UnauthorizedException("Telegram authentication subject is invalid");
    }

    return result.payload as TelegramClaims;
  }
}
