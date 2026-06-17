import { Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { createRemoteJWKSet, type JWTPayload, jwtVerify } from "jose";

const GOOGLE_ISSUER = "https://accounts.google.com";
const GOOGLE_AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_ENDPOINT = "https://www.googleapis.com/oauth2/v3/certs";

export type GoogleClaims = JWTPayload & {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

type GoogleTokenResponse = {
  id_token?: unknown;
};

function getRequiredGoogleEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new ServiceUnavailableException(`${name} is not configured`);
  }
  return value;
}

@Injectable()
export class GoogleOidcClient {
  private readonly jwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_ENDPOINT));

  getClientId(): string {
    return getRequiredGoogleEnv("GOOGLE_CLIENT_ID");
  }

  getRedirectUri(): string {
    return getRequiredGoogleEnv("GOOGLE_REDIRECT_URI");
  }

  getAuthorizationUrl(input: { codeChallenge: string; nonce: string; state: string }): string {
    const url = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
    url.searchParams.set("client_id", this.getClientId());
    url.searchParams.set("redirect_uri", this.getRedirectUri());
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", input.state);
    url.searchParams.set("nonce", input.nonce);
    url.searchParams.set("code_challenge", input.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
  }

  async exchangeCodeForClaims(input: { code: string; codeVerifier: string; nonce: string }): Promise<GoogleClaims> {
    const clientId = this.getClientId();
    const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: input.code,
        redirect_uri: this.getRedirectUri(),
        client_id: clientId,
        client_secret: getRequiredGoogleEnv("GOOGLE_CLIENT_SECRET"),
        code_verifier: input.codeVerifier,
      }),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
    });

    if (!response.ok) {
      throw new UnauthorizedException("Google authentication failed");
    }

    const tokenResponse = (await response.json()) as GoogleTokenResponse;
    if (typeof tokenResponse.id_token !== "string") {
      throw new UnauthorizedException("Google response did not include an ID token");
    }

    const result = await jwtVerify(tokenResponse.id_token, this.jwks, {
      audience: clientId,
      issuer: GOOGLE_ISSUER,
    });

    if (result.payload.nonce !== input.nonce) {
      throw new UnauthorizedException("Google authentication nonce is invalid");
    }

    if (typeof result.payload.sub !== "string" || !result.payload.sub) {
      throw new UnauthorizedException("Google authentication subject is invalid");
    }

    return result.payload as GoogleClaims;
  }
}
