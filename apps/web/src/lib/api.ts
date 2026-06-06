export const API_URL = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1");

type ApiFetchInit = RequestInit & {
  redirectOnUnauthorized?: boolean;
  retryOnUnauthorized?: boolean;
};

let refreshPromise: Promise<boolean> | null = null;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(path: string, init?: ApiFetchInit): Promise<T> {
  const response = await request(path, init);
  if (response.status === 401 && shouldRetryUnauthorized(path, init)) {
    const refreshed = await refreshSession();
    if (refreshed) {
      const retryResponse = await request(path, { ...init, retryOnUnauthorized: false });
      if (retryResponse.ok) return parseSuccess<T>(retryResponse);
      if (retryResponse.status === 401 && init?.redirectOnUnauthorized !== false) redirectToSessionExpired();
      await throwApiError(retryResponse, "La requete a echoue");
    }
    if (init?.redirectOnUnauthorized !== false) redirectToSessionExpired();
  }

  if (!response.ok) await throwApiError(response, "La requete a echoue");
  return parseSuccess<T>(response);
}

export async function apiUpload<T>(path: string, body: FormData): Promise<T> {
  const response = await requestUpload(path, body);
  if (response.status === 401) {
    const refreshed = await refreshSession();
    if (refreshed) {
      const retryResponse = await requestUpload(path, body);
      if (retryResponse.ok) return parseSuccess<T>(retryResponse);
      if (retryResponse.status === 401) redirectToSessionExpired();
      await throwApiError(retryResponse, "Le transfert a echoue");
    }
    redirectToSessionExpired();
  }

  if (!response.ok) await throwApiError(response, "Le transfert a echoue");
  return parseSuccess<T>(response);
}

async function request(path: string, init?: ApiFetchInit) {
  const { redirectOnUnauthorized: _redirectOnUnauthorized, retryOnUnauthorized: _retryOnUnauthorized, ...fetchInit } = init ?? {};
  void _redirectOnUnauthorized;
  void _retryOnUnauthorized;
  return fetch(createApiUrl(path), {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...getCsrfHeader(),
      ...fetchInit.headers,
    },
    ...fetchInit,
  });
}

async function requestUpload(path: string, body: FormData) {
  return fetch(createApiUrl(path), {
    body,
    credentials: "include",
    headers: getCsrfHeader(),
    method: "POST",
  });
}

function normalizeApiUrl(url: string) {
  return url.replace(/\/+$/, "");
}

function createApiUrl(path: string) {
  return `${API_URL}/${path.replace(/^\/+/, "")}`;
}

function getCsrfHeader() {
  const csrfToken =
    typeof document === "undefined"
      ? undefined
      : document.cookie
          .split("; ")
          .find((cookie) => cookie.startsWith("csrf_token="))
          ?.split("=")[1];
  return csrfToken ? { "x-csrf-token": decodeURIComponent(csrfToken) } : {};
}

function shouldRetryUnauthorized(path: string, init?: ApiFetchInit) {
  if (init?.retryOnUnauthorized === false) return false;
  return ![
    "/auth/login",
    "/auth/logout",
    "/auth/refresh",
    "/auth/password-reset/request",
    "/auth/password-reset/confirm",
  ].includes(path);
}

async function refreshSession() {
  refreshPromise ??= request("/auth/refresh", {
    method: "POST",
    redirectOnUnauthorized: false,
    retryOnUnauthorized: false,
  })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

function redirectToSessionExpired() {
  if (typeof window === "undefined") return;
  if (window.location.pathname !== "/session-expired") {
    window.location.assign("/session-expired");
  }
}

async function throwApiError(response: Response, fallback: string): Promise<never> {
  const payload = (await response.json().catch(() => undefined)) as
    | { message?: string; error?: { message?: string } }
    | undefined;
  throw new ApiError(payload?.error?.message ?? payload?.message ?? fallback, response.status);
}

async function parseSuccess<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
