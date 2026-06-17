export type ErrorType<Error> = Error;
export type BodyType<BodyData> = BodyData;

type ApiErrorBody = {
  code?: string;
  message?: string | string[];
  error?: string;
};

export type ApiClientError = Error & {
  info?: unknown;
  status?: number;
};

export const EMAIL_VERIFICATION_REQUIRED_CODE = "EMAIL_VERIFICATION_REQUIRED";

async function parseResponseBody(response: Response): Promise<unknown> {
  if ([204, 205, 304].includes(response.status)) return undefined;

  const body = await response.text();
  if (!body) return undefined;

  const contentType = response.headers.get("content-type") ?? "";
  return contentType.includes("application/json") ? JSON.parse(body) : body;
}

export function getApiBaseUrl(): string {
  const configuredUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

  if (typeof window === "undefined") {
    return configuredUrl;
  }

  try {
    const apiUrl = new URL(configuredUrl);
    const webHostname = window.location.hostname;
    const apiHostname = apiUrl.hostname;
    const loopbackHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

    if (loopbackHosts.has(apiHostname) && loopbackHosts.has(webHostname) && apiHostname !== webHostname) {
      apiUrl.hostname = webHostname;
      return apiUrl.toString().replace(/\/$/, "");
    }
  } catch {
    return configuredUrl;
  }

  return configuredUrl;
}

function getErrorMessage(body: unknown): string {
  if (!body || typeof body !== "object") return "API request failed";

  const apiError = body as ApiErrorBody;
  if (Array.isArray(apiError.message)) return apiError.message.join(", ");
  return apiError.message ?? apiError.error ?? "API request failed";
}

export async function apiClient<T>(url: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${url}`, {
      ...options,
      credentials: "include",
      headers: {
        ...options.headers,
      },
    });
  } catch (error) {
    throw new Error(
      error instanceof Error && error.message
        ? `Не удалось подключиться к API: ${error.message}`
        : "Не удалось подключиться к API"
    );
  }

  const body = await parseResponseBody(response);

  if (!response.ok) {
    const error = new Error(getErrorMessage(body)) as ApiClientError;
    error.info = body;
    error.status = response.status;
    throw error;
  }

  return body as T;
}

export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof Error && ("status" in error || "info" in error);
}

export function getApiErrorCode(error: unknown): string | null {
  if (!isApiClientError(error) || !error.info || typeof error.info !== "object") return null;
  const code = (error.info as ApiErrorBody).code;
  return typeof code === "string" ? code : null;
}

export function isEmailVerificationRequiredError(error: unknown): boolean {
  return getApiErrorCode(error) === EMAIL_VERIFICATION_REQUIRED_CODE;
}
