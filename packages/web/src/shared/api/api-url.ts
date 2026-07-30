export const LOCAL_API_BASE_URL = "http://localhost:4000";

const API_URL_REQUIREMENT =
  "VITE_API_URL must be an absolute HTTP(S) URL without credentials, query parameters, or a hash.";

export function normalizeApiBaseUrl(value: string): string {
  const configuredUrl = value.trim();

  if (!configuredUrl) {
    throw new Error(API_URL_REQUIREMENT);
  }

  let apiUrl: URL;
  try {
    apiUrl = new URL(configuredUrl);
  } catch {
    throw new Error(API_URL_REQUIREMENT);
  }

  if (
    !["http:", "https:"].includes(apiUrl.protocol) ||
    !apiUrl.hostname ||
    apiUrl.username ||
    apiUrl.password ||
    apiUrl.search ||
    apiUrl.hash
  ) {
    throw new Error(API_URL_REQUIREMENT);
  }

  return configuredUrl.replace(/\/+$/, "");
}

export function requireApiBaseUrlForBuild(value: string | undefined): string {
  if (!value?.trim()) {
    throw new Error(
      "VITE_API_URL is required for production builds. Set it to the deployed API origin, for example https://api.finnn.xyz."
    );
  }

  return normalizeApiBaseUrl(value);
}
