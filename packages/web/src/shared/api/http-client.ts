export type ErrorType<Error> = Error;
export type BodyType<BodyData> = BodyData;

type ApiErrorBody = {
  message?: string | string[];
  error?: string;
};

async function parseResponseBody(response: Response): Promise<unknown> {
  if ([204, 205, 304].includes(response.status)) return undefined;

  const body = await response.text();
  if (!body) return undefined;

  const contentType = response.headers.get("content-type") ?? "";
  return contentType.includes("application/json") ? JSON.parse(body) : body;
}

function getApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
}

function getErrorMessage(body: unknown): string {
  if (!body || typeof body !== "object") return "API request failed";

  const apiError = body as ApiErrorBody;
  if (Array.isArray(apiError.message)) return apiError.message.join(", ");
  return apiError.message ?? apiError.error ?? "API request failed";
}

export async function apiClient<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${url}`, {
    ...options,
    credentials: "include",
    headers: {
      ...options.headers,
    },
  });
  const body = await parseResponseBody(response);

  if (!response.ok) {
    const error = new Error(getErrorMessage(body)) as Error & {
      info?: unknown;
      status?: number;
    };
    error.info = body;
    error.status = response.status;
    throw error;
  }

  return body as T;
}
